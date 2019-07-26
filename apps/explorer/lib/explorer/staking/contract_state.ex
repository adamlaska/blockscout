defmodule Explorer.Staking.ContractState do
  @moduledoc """
  Fetches all information from POSDAO staking contracts.
  All contract calls are batched into four requests, according to their dependencies.
  Subscribes to new block notifications and refreshes when previously unseen block arrives.
  """

  use GenServer

  alias Explorer.Chain
  alias Explorer.Chain.Hash
  alias Explorer.Chain.Events.{Publisher, Subscriber}
  alias Explorer.SmartContract.Reader
  alias Explorer.Staking.ContractReader
  alias Explorer.Token.BalanceReader
  alias Explorer.Token.MetadataRetriever

  @table_name __MODULE__
  @table_keys [
    :token_contract_address,
    :token,
    :min_candidate_stake,
    :min_delegator_stake,
    :epoch_number,
    :epoch_end_block
  ]

  defstruct [
    :seen_block,
    :contracts,
    :abi
  ]

  @spec get(atom(), value) :: value when value: any()
  def get(key, default \\ nil) when key in @table_keys do
    with info when info != :undefined <- :ets.info(@table_name),
         [{_, value}] <- :ets.lookup(@table_name, key) do
      value
    else
      _ -> default
    end
  end

  def start_link([]) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  def init([]) do
    :ets.new(@table_name, [
      :set,
      :named_table,
      :public,
      read_concurrency: true,
      write_concurrency: true
    ])

    Subscriber.to(:blocks, :realtime)

    staking_abi = abi("StakingAuRa")
    validator_set_abi = abi("ValidatorSetAuRa")
    block_reward_abi = abi("BlockRewardAuRa")

    staking_contract_address = Application.get_env(:explorer, __MODULE__)[:staking_contract_address]
    metadata_address = Application.get_env(:explorer, __MODULE__)[:metadata_contract_address]

    %{"validatorSetContract" => {:ok, [validator_set_contract_address]}} =
      Reader.query_contract(staking_contract_address, staking_abi, %{"validatorSetContract" => []})

    %{"blockRewardContract" => {:ok, [block_reward_contract_address]}} =
      Reader.query_contract(validator_set_contract_address, validator_set_abi, %{"blockRewardContract" => []})

    state = %__MODULE__{
      seen_block: 0,
      contracts: %{
        staking: staking_contract_address,
        validator_set: validator_set_contract_address,
        block_reward: block_reward_contract_address,
        metadata: metadata_address
      },
      abi: staking_abi ++ validator_set_abi ++ block_reward_abi
    }

    {:ok, state, {:continue, []}}
  end

  def handle_continue(_, state) do
    fetch_state(state.contracts, state.abi)
    {:noreply, state}
  end

  @doc "Handles new blocks and decides to fetch fresh chain info"
  def handle_info({:chain_event, :blocks, :realtime, blocks}, state) do
    latest_block = Enum.max_by(blocks, & &1.number)

    if latest_block.number > state.seen_block do
      fetch_state(state.contracts, state.abi)
      token = get(:token_contract_address, nil)
      try_update_supply(token, latest_block.number, state.contracts, state.abi)
      {:noreply, %{state | seen_block: latest_block.number}}
    else
      {:noreply, state}
    end
  end

  defp try_update_supply(token, current_block_num, contracts, abi) do
    epoch_start = get(:epoch_start_block, 0)

    if epoch_start == current_block_num do
      update_supply(token, current_block_num - 1, contracts, abi)
    end
  end

  defp update_supply(token, prev_block_num, contracts, abi) do
    _addresses =
      contracts
      |> Enum.flat_map(&get_addresses(prev_block_num, abi, &1))
      |> Enum.map(&add_balance(token, prev_block_num, &1))
      |> Enum.into(%{})

    _supply = MetadataRetriever.get_functions_of(contracts[:metadata], prev_block_num)
  end

  defp add_balance(token, block_num, contract) do
    hash_string = Hash.to_string(contract)

    {:ok, balance} =
      BalanceReader.get_balances_of(%{
        token_contract_address_hash: token,
        address_hash: hash_string,
        block_number: block_num
      })

    {hash_string, balance}
  end

  defp get_addresses(block_num, abi, contract) do
    address_response =
      ContractReader.perform_requests(
        ContractReader.update_requests(),
        contract,
        abi,
        block_num
      )

    address_response[:staking_addresses]
  end

  defp fetch_state(contracts, abi) do
    global_responses = ContractReader.perform_requests(ContractReader.global_requests(), contracts, abi)

    settings =
      global_responses
      |> Map.take([
        :token_contract_address,
        :min_candidate_stake,
        :min_delegator_stake,
        :epoch_number,
        :epoch_end_block,
        :epoch_start_block
      ])
      |> Map.to_list()
      |> Enum.concat(token: get_token(global_responses.token_contract_address))

    :ets.insert(@table_name, settings)

    pools = global_responses.active_pools ++ global_responses.inactive_pools

    pool_staking_responses =
      pools
      |> Enum.map(&ContractReader.pool_staking_requests/1)
      |> ContractReader.perform_grouped_requests(pools, contracts, abi)

    pool_mining_responses =
      pool_staking_responses
      |> Map.values()
      |> Enum.map(&ContractReader.pool_mining_requests(&1.mining_address_hash))
      |> ContractReader.perform_grouped_requests(pools, contracts, abi)

    delegators =
      Enum.flat_map(pool_staking_responses, fn {pool_address, responses} ->
        Enum.map(responses.active_delegators, &{pool_address, &1, true}) ++
          Enum.map(responses.inactive_delegators, &{pool_address, &1, false})
      end)

    delegator_responses =
      delegators
      |> Enum.map(fn {pool_address, delegator_address, _} ->
        ContractReader.delegator_requests(pool_address, delegator_address)
      end)
      |> ContractReader.perform_grouped_requests(delegators, contracts, abi)

    staked_total = Enum.sum(for {_, pool} <- pool_staking_responses, pool.is_active, do: pool.staked_amount)
    [likelihood_values, total_likelihood] = global_responses.pools_likelihood

    likelihood =
      global_responses.pools_likely
      |> Enum.zip(likelihood_values)
      |> Enum.into(%{})

    pool_entries =
      Enum.map(pools, fn staking_address ->
        staking_response = pool_staking_responses[staking_address]
        mining_response = pool_mining_responses[staking_address]

        %{
          staking_address_hash: staking_address,
          delegators_count: length(staking_response.active_delegators),
          staked_ratio: ratio(staking_response.staked_amount, staked_total),
          likelihood: ratio(likelihood[staking_address] || 0, total_likelihood),
          block_reward_ratio:
            if mining_response.is_validator and staking_response.block_rewards != [] do
              Enum.at(staking_response.block_rewards, 0) / 1_000_000
            else
              max(ratio(staking_response.self_staked_amount, staking_response.staked_amount), 30)
            end,
          is_deleted: false
        }
        |> Map.merge(
          Map.take(staking_response, [
            :mining_address_hash,
            :is_active,
            :staked_amount,
            :self_staked_amount
          ])
        )
        |> Map.merge(
          Map.take(mining_response, [
            :is_validator,
            :was_validator_count,
            :is_banned,
            :banned_until,
            :was_banned_count
          ])
        )
      end)

    delegator_entries =
      Enum.map(delegator_responses, fn {{pool_address, delegator_address, is_active}, response} ->
        Map.merge(response, %{
          delegator_address_hash: delegator_address,
          pool_address_hash: pool_address,
          is_active: is_active
        })
      end)

    {:ok, _} =
      Chain.import(%{
        staking_pools: %{params: pool_entries},
        staking_pools_delegators: %{params: delegator_entries},
        timeout: :infinity
      })

    Publisher.broadcast(:staking_update)
  end

  defp get_token(address) do
    with {:ok, address_hash} <- Chain.string_to_address_hash(address),
         {:ok, token} <- Chain.token_from_address_hash(address_hash) do
      token
    else
      _ -> nil
    end
  end

  defp ratio(_numerator, 0), do: 0
  defp ratio(numerator, denominator), do: numerator / denominator * 100

  # sobelow_skip ["Traversal"]
  defp abi(file_name) do
    :explorer
    |> Application.app_dir("priv/contracts_abi/posdao/#{file_name}.json")
    |> File.read!()
    |> Jason.decode!()
  end
end
