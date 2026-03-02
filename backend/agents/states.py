from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class ResearchState(TypedDict):
    url: str
    page_content: str
    query: str
    research_plan: list[str]
    search_results: list[dict]
    synthesis: str
    message: Annotated[list, add_messages]

class SyncState(TypedDict):
    url: str
    page_content: str
    page_title: str
    tags: list[str]
    summary: str
    insights: list[str]
    notion_page_id: str
    already_synced: bool
    messages: Annotated[list, add_messages]

class AuditSate(TypedDict):
    url: str
    page_content: str
    industry: str
    risk_level: str
    risks: list[dict]
    recommendation: str
    human_review_needed: bool
    messages: Annotated[list, add_messages]

class ChatState(TypedDict):
    url: str
    page_content: str
    message: str
    history: list[dict]
    response: str
    needs_search: bool
    search_results: list[dict]
    messages: Annotated[list, add_messages]