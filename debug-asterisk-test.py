#!/usr/bin/env python3
"""
🎯 Targeted Asterisk Detection Test
Find exactly where asterisks are appearing in AI responses
"""

import requests
import json
import re

def test_specific_response():
    """Test the specific question that's causing asterisk issues"""
    
    ai_config = {
        "api_key": "AIzaSyB-j8iXAEg_W-I2l3PodnJMoO_wgai2VDU",
        "base_url": "https://generativelanguage.googleapis.com/v1beta",
        "model": "gemini-2.5-flash"
    }
    
    system_prompt = """You are NULL VOID AI, a helpful assistant for users of the NULL VOID browser extension.

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

    test_questions = [
        "How does NULL VOID protect me from dangerous websites?",
        "Can you explain all the features of NULL VOID and how to use them?",
        "How do I use the disposable browser feature?"
    ]
    
    print("🎯 Testing for Asterisk Issues...")
    
    for i, question in enumerate(test_questions, 1):
        print(f"\n🔍 Test {i}: {question}")
        
        prompt = f"{system_prompt}\n\nUser Question: {question}\n\nProvide helpful, user-friendly guidance with clean formatting:"
        
        url = f"{ai_config['base_url']}/models/{ai_config['model']}:generateContent"
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 1200
            }
        }
        
        try:
            response = requests.post(
                f"{url}?key={ai_config['api_key']}", 
                headers={"Content-Type": "application/json"}, 
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                ai_response = data["candidates"][0]["content"]["parts"][0]["text"]
                
                # Find all asterisks and their context
                asterisk_positions = []
                lines = ai_response.split('\n')
                
                for line_num, line in enumerate(lines, 1):
                    if '*' in line:
                        asterisk_positions.append(f"Line {line_num}: {line.strip()}")
                
                print(f"📝 Response length: {len(ai_response)} characters")
                print(f"🔍 Asterisks found: {len(re.findall(r'\\*', ai_response))}")
                
                if asterisk_positions:
                    print("📍 Asterisk locations:")
                    for pos in asterisk_positions:
                        print(f"   {pos}")
                else:
                    print("✅ No asterisks found!")
                
                print(f"\n📄 Full Response:")
                print("=" * 50)
                print(ai_response)
                print("=" * 50)
                
            else:
                print(f"❌ HTTP Error: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_specific_response()