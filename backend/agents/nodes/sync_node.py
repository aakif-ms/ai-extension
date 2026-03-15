import json
from langchain_core.messages import HumanMessage

async def sync_classifier(state, llm):
    prompt = f"""Classify this webpage type. URL: {state.url}
                 Title: {state.page_title}
                 Content (first 500 chars): {state.page_content[:500]}
                 
                 Return JSON: {{"page_type": "article|product|documentation|news|other"}}"""
    
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    try:
        data = json.loads(response.content)
        page_type = data.get("page_type", "other")
    except Exception:
        page_type = "other"
    return {"page_type": page_type}

async def sync_duplicate_check(state, notion):
    already_synced = await notion.check_duplicate(state.url)
    return {"already_synced": already_synced}

async def sync_analyzer(state, llm):
    prompt = f"""Analyze this {state.page_type} page and extract structured information.

                 Title: {state.page_title}
                 URL: {state.url}
                 Content: {state.page_content[:3000]}
                 
                 Return JSON:
                 {{
                   "summary": "2-3 sentence summary",
                   "tags": ["tag1", "tag2", "tag3"],
                   "insights": ["key insight 1", "key insight 2", "key insight 3"]
                 }}"""
    
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    try:
        data = json.loads(response.content)
    except Exception:
        data = {"summary": state.page_content[:200], "tags": [], "insights": []}
    return data

async def sync_notion_writer(state, notion):
    page_id = await notion.create_page(
        title=state.page_title,
        url=state.url,
        page_type=state.page_type,
        summary=state.summary,
        tags=state.tags,
        insights=state.insights
    )
    return {"notion_page_id": page_id}

async def sync_skip(state):
    return {"notion_page_id": "already_exists"}