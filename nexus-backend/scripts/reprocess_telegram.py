import requests
import json
import time

TOKEN = "8766162857:AAFMHV-ACeNi8kF9OTT9biDamAGPm_Q7ck8"
WEBHOOK_URL = "http://127.0.0.1:8000/webhook/telegram/receive"

def get_updates():
    url = f"https://api.telegram.org/bot{TOKEN}/getUpdates"
    r = requests.get(url)
    return r.json()

def send_to_webhook(payload):
    r = requests.post(WEBHOOK_URL, json=payload)
    print(f"Sent to webhook: {r.status_code}")

if __name__ == "__main__":
    updates = get_updates()
    if updates["ok"]:
        for update in updates["result"]:
            print(f"Processing update {update['update_id']}...")
            send_to_webhook(update)
            # Marcar como lido (offset)
            requests.get(f"https://api.telegram.org/bot{TOKEN}/getUpdates?offset={update['update_id'] + 1}")
            time.sleep(1)
    else:
        print("Failed to get updates")
