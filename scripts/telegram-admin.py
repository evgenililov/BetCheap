#!/usr/bin/env python3
"""Activate/status/pause the deployed bot without accessing or printing the Telegram bot token."""
import argparse, getpass, json, urllib.request, urllib.error
p=argparse.ArgumentParser()
p.add_argument('action', choices=['activate','status','pause'])
a=p.parse_args()
secret=getpass.getpass('TELEGRAM_WEBHOOK_SECRET (hidden input): ')
req=urllib.request.Request('https://betcheap.netlify.app/.netlify/functions/telegram-admin',data=json.dumps({'action':a.action}).encode(),headers={'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':secret},method='POST')
try:
 with urllib.request.urlopen(req,timeout=60) as r:print(r.read().decode())
except urllib.error.HTTPError as e:
 print('HTTP',e.code,e.read().decode());raise SystemExit(1)
except Exception:
 print('Connection failed; check deployment and retry status before activation.');raise SystemExit(1)
