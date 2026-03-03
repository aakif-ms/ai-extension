import re
import logging

logger = logging.getLogger(__name__)

RISK_PATTERNS = {
    "data_sale": {
        "patterns": [r"sell.{0,20}(your|personal|user).{0,10}data", r"share.{0,20}third.party"],
        "severity": "high",
        "description": "Data may be sold or shared with third parties",
    },
    "location_tracking": {
        "patterns": [r"(precise|exact|real-?time).{0,10}location", r"gps.{0,20}track"],
        "severity": "high",
        "description": "Precise location tracking detected",
    },
    "biometric": {
        "patterns": [r"biometric", r"facial.recognition", r"fingerprint"],
        "severity": "critical",
        "description": "Biometric data collection mentioned",
    },
    "auto_renewal": {
        "patterns": [r"automatically.{0,15}renew", r"auto-?renew"],
        "severity": "medium",
        "description": "Subscription auto-renewal clause detected",
    },
    "arbitration": {
        "patterns": [r"binding.{0,10}arbitration", r"class.action.waiver"],
        "severity": "medium",
        "description": "Mandatory arbitration or class action waiver",
    },
    "data_retention": {
        "patterns": [r"indefinitely", r"retain.{0,20}forever", r"never.{0,10}delet"],
        "severity": "medium",
        "description": "Data may be retained indefinitely",
    },
}

class AuditTools:
    def scan_content(self, content: str) -> list[dict]:
        content_lower = content.lower()
        found_risks = []
        
        for risk_type, config in RISK_PATTERNS.items():
            for pattern in config["patterns"]:
                if re.search(pattern, content_lower):
                    found_risks.append({
                        "type": risk_type,
                        "description": config["description"],
                        "severity": config["severity"]
                    })
                    break
        return found_risks

    def detect_dark_patterns(self, content: str) -> list[dict]:
        """Detect UI/UX dark patterns from page text."""
        patterns = []
        dark_triggers = [
            ("urgency", r"(only \d+ left|limited time|expires soon)", "medium"),
            ("hidden_cost", r"(plus.{0,20}fee|handling.{0,10}charge|processing fee)", "medium"),
            ("confirm_shaming", r"(no thanks|i don't want|i prefer to pay more)", "low"),
            ("roach_motel", r"(cancel.{0,20}call us|cancel.{0,20}mail)", "high"),
        ]

        content_lower = content.lower()
        for name, pattern, severity in dark_triggers:
            if re.search(pattern, content_lower):
                patterns.append({
                    "type": f"dark_pattern_{name}",
                    "description": f"Dark pattern detected: {name.replace('_', ' ')}",
                    "severity": severity,
                })
        return patterns

        