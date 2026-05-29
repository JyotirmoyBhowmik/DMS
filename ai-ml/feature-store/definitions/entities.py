from feast import Entity

outlet = Entity(
    name="outlet",
    value_type=Entity.ValueType.INT64,
    join_keys=["outlet_id"],
    description="Unique identifier for retail outlet",
)

agent = Entity(
    name="agent",
    value_type=Entity.ValueType.INT64,
    join_keys=["agent_id"],
    description="Unique identifier for sales agent",
)
