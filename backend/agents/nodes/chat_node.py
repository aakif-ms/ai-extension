import json
from langchain_core.messages import HumanMessage, SystemMessage

async def chat_intent_router(state, llm):
    prompt = f"""Does this question require a live web search to answer accurately?
                Question: {state.message}
                Page URL: {state.url}

                Return JSON: {{"needs_search": true|false, "reason": "brief reason"}}"""
    
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    try:
        data = json.loads(response.content)
        needs_search = data.get("needs_search", False)
    except Exception:
        needs_search = False
    return {"needs_search": needs_search}

async def chat_searcher(state, tavily):
    results = await tavily.search(state.message)
    return {"search_results": results}

async def chat_responder(state, llm):
    search_ctx = ""
    if state.search_results:
        search_ctx = "\n\nWeb Search Results:\n" + "\n".join([
            f"- {r.get('title')}: {r.get('content', '')[:200]}"
            for r in state.search_results[:4]
        ])

    history_text = "\n".join([
        f"{m['role'].capitalize()}: {m['content']}"
        for m in (state.history or [])[-6:]
    ])

    system = f"""You are Sentinel, an intelligent browser assistant. You have access to the current webpage.
                Current Page: {state.url}
                Page Content (first 2000 chars):
                {state.page_content[:2000]}
                {search_ctx}"""
    
    messages = [SystemMessage(content=system)]
    if history_text:
        messages.append(HumanMessage(content=f"Previous conversation:\n{history_text}"))
    messages.append(HumanMessage(content=state.message))

    response = await llm.ainvoke(messages)
    return {"response": response.content}