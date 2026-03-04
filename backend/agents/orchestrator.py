import json
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver

from agents.graph import build_audit_graph, build_chat_graph, build_research_graph, build_sync_graph
from tools import tavily_tools, notion_tools

def create_graph():
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    memory = MemorySaver()
    tavily = tavily_tools()
    notion = notion_tools()
    
    return {
        "researcher": build_research_graph(llm, tavily, memory),
        "sync": build_sync_graph(llm, notion, memory),
        "audit": build_audit_graph(llm, memory),
        "chat": build_chat_graph(llm, tavily, memory)
    }
    
async def run_research(graphs, url, page_content, query, session_id):
    config = {"configurable": {"thread_id": f"{session_id}-research"}}
    state = await graphs["research"].ainvoke(
        {"url": url, "page_content": page_content, "query": query, "messages": []},
        config
    )
    return {
        "synthesis": state["synthesis"],
        "sources": [r.get("url") for r in state.get("search_results", [])],
        "plan": state.get("research_plan", []),
    }
    
async def run_notion_sync(graphs, url, page_content, page_title, session_id):
    config = {"configurable": {"thread_id": f"{session_id}-sync"}}
    state = await graphs["sync"].ainvoke(
        {"url": url, "page_content": page_content, "page_title": page_title, "messages": []},
        config
    )
    if state.get("already_synced"):
        return {"status": "already_synced", "message": "This page was already saved to Notion."}
    return {
        "status":         "synced",
        "notion_page_id": state.get("notion_page_id"),
        "summary":        state.get("summary"),
        "tags":           state.get("tags", []),
        "insights":       state.get("insights", []),
    }
    
async def run_audit(graphs, url, page_content, session_id):
    config = {"configurable": {"thread_id": f"{session_id}-audit"}}
    state = await graphs["audit"].ainvoke(
        {"url": url, "page_content": page_content, "messages": []},
        config
    )
    return {
        "risk_level":          state.get("risk_level", "low"),
        "industry":            state.get("industry", "other"),
        "risks":               state.get("risks", []),
        "recommendation":      state.get("recommendation", ""),
        "human_review_needed": state.get("human_review_needed", False),
    }

async def run_chat(graphs, url, page_content, message, history, session_id):
    config = {"configurable": {"thread_id": f"{session_id}-chat-stream"}}
    async for chunk in graphs["chat"].astream(
        {"url": url, "page_content": page_content, "message": message, "history": history, "messages": []},
        config
    ):
        if "responder" in chunk:
            response = chunk["responder"].get("response", "")
            if response:
                yield json.dumps({"chunk": response})