import yaml
import streamlit as st
from snowflake.snowpark.context import get_active_session
from snowflake.snowpark.exceptions import SnowparkSQLException

st.set_page_config(page_title="Agent Tool Manager", layout="wide")

session = get_active_session()


# ── Data helpers ──────────────────────────────────────────────────────────────

@st.cache_data(ttl=60)
def get_agents():
    rows = session.sql("SHOW AGENTS IN ACCOUNT").collect()
    return [
        {
            "name": r["name"],
            "database": r["database_name"],
            "schema": r["schema_name"],
            "full_name": f"{r['database_name']}.{r['schema_name']}.{r['name']}",
        }
        for r in rows
    ]


@st.cache_data(ttl=10)
def get_agent_spec(agent_db, agent_schema, agent_name) -> dict:
    rows = session.sql(
        f"DESCRIBE AGENT {agent_db}.{agent_schema}.{agent_name}"
    ).collect()
    return yaml.safe_load(rows[0]["agent_spec"]) or {}


@st.cache_data(ttl=60)
def get_cortex_search_services():
    rows = session.sql("SHOW CORTEX SEARCH SERVICES IN ACCOUNT").collect()
    return [
        {
            "name": r["name"],
            "database": r["database_name"],
            "schema": r["schema_name"],
            "full_name": f"{r['database_name']}.{r['schema_name']}.{r['name']}",
        }
        for r in rows
    ]


@st.cache_data(ttl=60)
def get_semantic_views():
    rows = session.sql("SHOW SEMANTIC VIEWS IN ACCOUNT").collect()
    return [
        {
            "name": r["name"],
            "database": r["database_name"],
            "schema": r["schema_name"],
            "full_name": f"{r['database_name']}.{r['schema_name']}.{r['name']}",
        }
        for r in rows
    ]


def save_agent_spec(agent_db, agent_schema, agent_name, spec: dict):
    spec_yaml = yaml.dump(spec, default_flow_style=False, sort_keys=False)
    session.sql(
        f"ALTER AGENT {agent_db}.{agent_schema}.{agent_name} "
        f"MODIFY LIVE VERSION SET SPECIFICATION = $${spec_yaml}$$"
    ).collect()


# ── UI ────────────────────────────────────────────────────────────────────────

st.title("Snowflake Intelligence Agent — Tool Manager")

agents = get_agents()
if not agents:
    st.warning("No Intelligence Agents found in this account.")
    st.stop()

agent_options = {a["full_name"]: a for a in agents}
selected_full_name = st.selectbox("Select an Intelligence Agent", list(agent_options.keys()))
agent = agent_options[selected_full_name]

st.divider()

# Load current spec
spec = get_agent_spec(agent["database"], agent["schema"], agent["name"])
current_tools: list = spec.get("tools") or []
tool_resources: dict = spec.get("tool_resources") or {}

# ── Parse currently configured tools by type ──────────────────────────────────
# Scan tool_resources directly — don't rely on tool_spec type matching

# search_service value (upper) -> tool_name
attached_search: dict[str, str] = {
    res["search_service"].upper(): tname
    for tname, res in tool_resources.items()
    if isinstance(res, dict) and "search_service" in res
}

# semantic_view value (upper) -> tool_name
attached_analyst: dict[str, str] = {
    res.get("semantic_view", res.get("semantic_model", "")).upper(): tname
    for tname, res in tool_resources.items()
    if isinstance(res, dict) and ("semantic_view" in res or "semantic_model" in res)
}

# generic (procedure/UDF) tools
KNOWN_TYPES = {"cortex_search", "cortex_analyst_text_to_sql", "web_search", "data_to_chart"}
generic_tools: list[dict] = [
    t for t in current_tools
    if t.get("tool_spec", {}).get("type") not in KNOWN_TYPES
]

BUILTIN_TOOLS = {"web_search": "Web Search", "data_to_chart": "Data to Chart"}
active_builtin_types: set[str] = {
    t.get("tool_spec", {}).get("type")
    for t in current_tools
    if t.get("tool_spec", {}).get("type") in BUILTIN_TOOLS
}

# Debug
with st.expander("Debug"):
    st.write("current_tools:", current_tools)
    st.write("attached_search:", attached_search)
    st.write("attached_analyst:", attached_analyst)
    st.write("tool_resources:", tool_resources)

st.subheader(f"Available Tools — `{selected_full_name}`")
st.caption("Check to enable a tool, uncheck to remove it. Click **Save** when done.")

desired_search: dict[str, bool] = {}
desired_analyst: dict[str, bool] = {}
desired_generic_keep: dict[str, bool] = {}
desired_builtin: dict[str, bool] = {}


def suffix_match(full_name: str, lookup: dict) -> bool:
    """True if any suffix of full_name (dot-split) is a key in lookup."""
    parts = full_name.upper().split(".")
    return any(".".join(parts[j:]) in lookup for j in range(len(parts)))


def lookup_tool_name(full_name: str, lookup: dict, default: str) -> str:
    parts = full_name.upper().split(".")
    for j in range(len(parts)):
        key = ".".join(parts[j:])
        if key in lookup:
            return lookup[key]
    return default


# ── Cortex Search ─────────────────────────────────────────────────────────────
st.markdown("#### Cortex Search")
search_services = get_cortex_search_services()
if search_services:
    cols = st.columns(2)
    for i, svc in enumerate(search_services):
        with cols[i % 2]:
            desired_search[svc["full_name"]] = st.checkbox(
                svc["full_name"],
                value=suffix_match(svc["full_name"], attached_search),
                key=f"search_{svc['full_name']}",
            )
else:
    st.caption("No Cortex Search services found in this account.")

# ── Cortex Analyst ────────────────────────────────────────────────────────────
st.markdown("#### Cortex Analyst")
semantic_views = get_semantic_views()
if semantic_views:
    cols = st.columns(2)
    for i, sv in enumerate(semantic_views):
        with cols[i % 2]:
            desired_analyst[sv["full_name"]] = st.checkbox(
                sv["full_name"],
                value=suffix_match(sv["full_name"], attached_analyst),
                key=f"analyst_{sv['full_name']}",
            )
else:
    st.caption("No semantic views found in this account.")

# ── Generic / Procedure tools ─────────────────────────────────────────────────
if generic_tools:
    st.markdown("#### Procedure / UDF Tools")
    cols = st.columns(2)
    for i, t in enumerate(generic_tools):
        ts = t.get("tool_spec", {})
        tname = ts.get("name", "")
        res = tool_resources.get(tname) or {}
        identifier = res.get("identifier") or res.get("name") or tname
        with cols[i % 2]:
            desired_generic_keep[tname] = st.checkbox(
                f"{tname} — `{identifier}`",
                value=True,
                key=f"generic_{tname}",
            )

# ── Built-in Tools ────────────────────────────────────────────────────────────
st.markdown("#### Built-in Tools")
cols = st.columns(2)
for i, (tool_type, label) in enumerate(BUILTIN_TOOLS.items()):
    with cols[i % 2]:
        desired_builtin[tool_type] = st.checkbox(
            label,
            value=(tool_type in active_builtin_types),
            key=f"builtin_{tool_type}",
        )

st.divider()

if st.button("Save Changes", type="primary"):
    new_tools = []
    new_resources = {}

    # Cortex Search
    for svc in search_services:
        if not desired_search.get(svc["full_name"]):
            continue
        default_tname = svc["name"].lower().replace(" ", "_").replace("-", "_")
        tname = lookup_tool_name(svc["full_name"], attached_search, default_tname)
        existing_ts = next(
            (t["tool_spec"] for t in current_tools if t.get("tool_spec", {}).get("name") == tname),
            {},
        )
        new_tools.append({"tool_spec": {
            "type": "cortex_search",
            "name": tname,
            "description": existing_ts.get("description", f"Search {svc['name']}"),
        }})
        existing_res = tool_resources.get(tname) or {}
        new_resources[tname] = {**existing_res, "search_service": svc["full_name"]}

    # Cortex Analyst
    for sv in semantic_views:
        if not desired_analyst.get(sv["full_name"]):
            continue
        default_tname = sv["name"].lower().replace(" ", "_").replace("-", "_")
        tname = lookup_tool_name(sv["full_name"], attached_analyst, default_tname)
        existing_ts = next(
            (t["tool_spec"] for t in current_tools if t.get("tool_spec", {}).get("name") == tname),
            {},
        )
        new_tools.append({"tool_spec": {
            "type": "cortex_analyst_text_to_sql",
            "name": tname,
            "description": existing_ts.get("description", f"Analyst {sv['name']}"),
        }})
        existing_res = tool_resources.get(tname) or {}
        new_resources[tname] = {**existing_res, "semantic_view": sv["full_name"]}

    # Generic / procedure tools
    for t in generic_tools:
        tname = t.get("tool_spec", {}).get("name", "")
        if desired_generic_keep.get(tname, True):
            new_tools.append(t)
            if tname in tool_resources:
                new_resources[tname] = tool_resources[tname]

    # Built-in tools
    for tool_type, enabled in desired_builtin.items():
        if not enabled:
            continue
        existing_ts = next(
            (t["tool_spec"] for t in current_tools if t.get("tool_spec", {}).get("type") == tool_type),
            {},
        )
        new_tools.append({"tool_spec": {
            "type": tool_type,
            "name": existing_ts.get("name", tool_type),
            "description": existing_ts.get("description", BUILTIN_TOOLS[tool_type]),
        }})

    new_spec = {**spec, "tools": new_tools, "tool_resources": new_resources}

    try:
        with st.spinner("Saving…"):
            save_agent_spec(agent["database"], agent["schema"], agent["name"], new_spec)
        st.success("Agent updated.")
        get_agent_spec.clear()
        st.rerun()
    except SnowparkSQLException as e:
        st.error(f"Failed to save: {e}")
