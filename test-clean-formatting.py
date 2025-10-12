#!/usr/bin/env python3
"""
🧪 NULL VOID AI - Clean Formatting Validation Test
Tests AI responses for clean, natural formatting without asterisks or special characters
"""

import requests
import json
import re
import time
from datetime import datetime

class CleanFormattingTester:
    def __init__(self):
        self.ai_config = {
            "api_key": "AIzaSyB-j8iXAEg_W-I2l3PodnJMoO_wgai2VDU",
            "base_url": "https://generativelanguage.googleapis.com/v1beta",
            "model": "gemini-2.5-flash"
        }
        
        self.system_prompt = """You are NULL VOID AI, a helpful assistant for users of the NULL VOID browser extension.

🛡️ YOUR ROLE:
- Help users understand and use NULL VOID extension features
- Provide simple, easy-to-follow guidance
- Keep explanations user-friendly and accessible
- Focus on what users can see and do in the extension

🎯 RESPONSE FORMATTING RULES:
- Write in clean, natural sentences without asterisks or special formatting
- Use simple bullet points with hyphens (-) when listing steps
- Write clear paragraph breaks for easy reading
- Use everyday language that flows naturally
- Avoid markdown formatting, asterisks, or special characters in responses
- Make responses feel like friendly conversation, not technical documentation

🎯 RESPONSE GUIDELINES:
- Use simple, clear language that anyone can understand
- Give step-by-step instructions using the extension's buttons and menus
- Focus on user interface elements, not technical details
- Never mention file names, code, or internal configurations
- Be encouraging and helpful
- Keep cybersecurity advice practical and easy to follow
- Format responses as natural, readable text without special characters

⚠️ IMPORTANT:
- NO technical jargon or developer terms
- NO file names or internal system details
- NO asterisks (*) or markdown formatting in responses
- Focus on visible buttons, menus, and options in the extension
- Explain what features do for users, not how they work internally
- Write like you're having a friendly conversation"""

    def send_ai_message(self, user_message):
        """Send message to AI and get response"""
        prompt = f"{self.system_prompt}\n\nUser Question: {user_message}\n\nProvide helpful, user-friendly guidance with clean formatting:"
        
        url = f"{self.ai_config['base_url']}/models/{self.ai_config['model']}:generateContent"
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 1200
            }
        }
        
        headers = {"Content-Type": "application/json"}
        
        try:
            response = requests.post(
                f"{url}?key={self.ai_config['api_key']}", 
                headers=headers, 
                json=payload,
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}: {response.text}")
            
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"Request error: {str(e)}")
        except (KeyError, IndexError) as e:
            raise Exception(f"Response parsing error: {str(e)}")

    def analyze_formatting(self, response):
        """Analyze response for formatting quality"""
        issues = []
        formatting_score = 100
        
        # Count asterisks
        asterisk_count = len(re.findall(r'\*', response))
        if asterisk_count > 0:
            issues.append(f"{asterisk_count} asterisks found")
            formatting_score -= asterisk_count * 10
        
        # Check for markdown patterns
        markdown_patterns = [
            (r'\*\*[^*]+\*\*', "bold markdown"),
            (r'\*[^*]+\*', "italic markdown"),
            (r'#+\s', "header markdown"),
            (r'```', "code blocks"),
            (r'`[^`]+`', "inline code")
        ]
        
        for pattern, name in markdown_patterns:
            matches = re.findall(pattern, response)
            if matches:
                issues.append(f"{len(matches)} {name} patterns")
                formatting_score -= len(matches) * 5
        
        # Check for awkward patterns
        awkward_patterns = [
            (r'How to use:\*', "awkward asterisk placement"),
            (r'\*[A-Z]', "asterisk at sentence start"),
            (r'\.\*', "asterisk at sentence end"),
            (r':\s*\*', "asterisk after colon")
        ]
        
        for pattern, name in awkward_patterns:
            matches = re.findall(pattern, response)
            if matches:
                issues.append(f"{len(matches)} {name} instances")
                formatting_score -= len(matches) * 15
        
        # Reward natural language features
        natural_features = [
            (r'\. [A-Z]', "natural sentence breaks", 2),
            (r'\n\n', "paragraph breaks", 3),
            (r'^[A-Z][a-z]', "natural sentence starts", 1)
        ]
        
        for pattern, name, bonus in natural_features:
            matches = re.findall(pattern, response, re.MULTILINE)
            if matches:
                formatting_score += len(matches) * bonus
        
        formatting_score = max(0, min(100, formatting_score))
        is_cleanly_formatted = formatting_score >= 80 and asterisk_count == 0
        
        return {
            "formatting_score": round(formatting_score),
            "is_cleanly_formatted": is_cleanly_formatted,
            "issues": issues,
            "asterisk_count": asterisk_count,
            "details": f"Score: {round(formatting_score)}%, Asterisks: {asterisk_count}, Issues: {len(issues)}"
        }

    def log_test(self, test_name, result, analysis):
        """Log test results"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        status = "✅ PASS" if analysis["is_cleanly_formatted"] else "❌ FAIL"
        
        print(f"\n{'='*60}")
        print(f"🧪 {test_name} [{timestamp}]")
        print(f"Status: {status}")
        print(f"Formatting Score: {analysis['formatting_score']}%")
        print(f"Asterisk Count: {analysis['asterisk_count']}")
        print(f"Issues Found: {', '.join(analysis['issues']) if analysis['issues'] else 'None'}")
        print(f"\n📝 Response Preview:")
        print(f'"{result[:200]}..."')
        
        if not analysis["is_cleanly_formatted"]:
            print(f"\n⚠️  Formatting Issues:")
            for issue in analysis["issues"]:
                print(f"   - {issue}")

    def run_tests(self):
        """Run all formatting tests"""
        test_cases = [
            {
                "name": "Basic Feature Explanation",
                "question": "How does NULL VOID protect me from dangerous websites?"
            },
            {
                "name": "Step-by-Step Instructions", 
                "question": "How do I use the disposable browser feature?"
            },
            {
                "name": "Complex Feature List",
                "question": "Can you explain all the features of NULL VOID and how to use them?"
            },
            {
                "name": "Troubleshooting Help",
                "question": "What should I do if I see a yellow 'Fallback Mode' warning?"
            },
            {
                "name": "Safety Guidance",
                "question": "How do I use the temporary email feature for safe online registrations?"
            }
        ]
        
        print("🎯 Starting Clean Formatting Validation Tests...")
        print(f"Testing {len(test_cases)} scenarios for clean, natural formatting")
        
        pass_count = 0
        total_asterisks = 0
        total_formatting_score = 0
        
        for test_case in test_cases:
            try:
                print(f"\n🔄 Running: {test_case['name']}...")
                result = self.send_ai_message(test_case['question'])
                analysis = self.analyze_formatting(result)
                
                self.log_test(test_case['name'], result, analysis)
                
                if analysis['is_cleanly_formatted']:
                    pass_count += 1
                total_asterisks += analysis['asterisk_count']
                total_formatting_score += analysis['formatting_score']
                
                # Brief pause between tests
                time.sleep(1)
                
            except Exception as error:
                print(f"\n❌ {test_case['name']} FAILED: {error}")
        
        # Final Summary
        print(f"\n{'='*60}")
        print(f"📊 CLEAN FORMATTING TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Tests Passed: {pass_count}/{len(test_cases)} ({round(pass_count/len(test_cases)*100)}%)")
        print(f"Average Formatting Score: {round(total_formatting_score/len(test_cases))}%")
        print(f"Total Asterisks Found: {total_asterisks}")
        print(f"Clean Formatting Goal: {'✅ ACHIEVED' if total_asterisks == 0 else '❌ NEEDS WORK'}")
        
        if pass_count == len(test_cases) and total_asterisks == 0:
            print(f"\n🎉 ALL TESTS PASSED! AI responses have clean, natural formatting.")
        else:
            print(f"\n⚠️  Some tests need attention. Check formatting rules in AI system.")

def main():
    """Main test execution"""
    print("📝 NULL VOID AI - Clean Formatting Validation Test")
    print("Testing for clean, natural responses without asterisks or special characters\n")
    
    tester = CleanFormattingTester()
    tester.run_tests()

if __name__ == "__main__":
    main()