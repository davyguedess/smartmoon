import sys
import requests

def set_webhook(token, url):
    webhook_url = f"{url}/webhook/telegram/receive"
    api_url = f"https://api.telegram.org/bot{token}/setWebhook"
    
    payload = {
        "url": webhook_url,
        "drop_pending_updates": True
    }
    
    response = requests.post(api_url, json=payload)
    return response.json()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 set_telegram_webhook.py <BOT_TOKEN> <PUBLIC_URL>")
        sys.exit(1)
        
    token = sys.argv[1]
    url = sys.argv[2]
    
    if url.endswith("/"):
        url = url[:-1]
        
    result = set_webhook(token, url)
    print(result)
