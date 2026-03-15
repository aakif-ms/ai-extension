import json
import logging
from langchain_core.messages import HumanMessage

logger = logging.getLogger(__name__)

async def audit_industry_detector(state, llm):
    prompt = f"""Detect the industry/type of this website.
                 URL: {state.url}
                 Content (first 300 chars): {state.page_content[:300]}
 
                 Return JSON: {{"industry": "finance|ecommerce|news|social|other"}}"""
                 
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    try:
        data = json.loads(response.content)
        industry = data.get("industry", "other")
    except Exception:
        industry = "other"
    return {"industry": industry}

async def _run_audit_scan(state, llm, focus: str) -> dict:
    prompt = f"""You are a privacy and security auditor. Scan this page focusing on: {focus}

                URL: {state.url}
                Content: {state.page_content[:4000]}

                Return JSON:
                {{
                "risks": [
                    {{"type": "risk type", "description": "what was found", "severity": "low|medium|high|critical"}}
                ]
                }}"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    try:
        data = json.loads(response.content)
        risks = data.get("risks", [])
    except Exception:
        risks = []
    return {"risks": risks}

async def audit_finance(state, llm):
    return await _run_audit_scan(
        state, llm,
        focus="financial data collection, investment risks, regulatory compliance, hidden fees"
    )

async def audit_ecommerce(state, llm):
    return await _run_audit_scan(
        state, llm,
        focus="payment data handling, shipping policies, return policies, dark patterns, subscription traps"
    )
        
async def audit_general(state, llm):
    return await _run_audit_scan(
        state, llm,
        focus="data collection, cookie usage, third-party tracking, privacy policy red flags"
    )
    
async def audit_risk_assessor(state, llm):
    risks = state.risks
    severities = [r.get("severity", "low") for r in risks]

    level_map = {
        "critical": 4,
        "high": 3,
        "medium": 2,
        "low": 1
    }
    max_severity = max((level_map.get(s, 1) for s in severities), default=1)
    level_names = {4: "critical", 3: "high", 2: "medium", 1: "low"}
    risk_level = level_names[max_severity]

    prompt = f"""Summarize these privacy risks in a user-friendly way. Risk level: {risk_level}
                Risks: {json.dumps(risks[:5])}

                Write a 2-3 sentence recommendation for the user."""

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return {
        "risk_level": risk_level,
        "recommendation": response.content,
        "human_review_needed": risk_level in ("high", "critical"),
    }

async def audit_hitl(state):
    logger.warning(f"HITL Interrupt triggered at {state.url} -- {state.risk_level} risk")
    return {}