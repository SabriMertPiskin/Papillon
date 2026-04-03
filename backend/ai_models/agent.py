import os
from flask import Flask, request
import subprocess

app = Flask(__name__)

VBOX = r"D:\Oracle\VirtualBox\VBoxManage.exe"
VM_NAME = "django-kali"

@app.route("/start-vm")
def start_vm():
    vbox_path = request.args.get('path', '').strip() or VBOX

    if not os.path.exists(vbox_path):
        return f'error: VBoxManage path not found: {vbox_path}', 400

    try:
        subprocess.Popen([
            vbox_path,
            "startvm",
            VM_NAME,
            "--type",
            "gui"
        ])
        return "django-kali started"
    except Exception as exc:
        return f'error: {exc}', 500

@app.route("/stop-vm")
def stop_vm():
    vbox_path = request.args.get('path', '').strip() or VBOX

    if not os.path.exists(vbox_path):
        return f'error: VBoxManage path not found: {vbox_path}', 400

    try:
        subprocess.Popen([
            vbox_path,
            "controlvm",
            VM_NAME,
            "poweroff"
        ])
        return "django-kali powered off"
    except Exception as exc:
        return f'error: {exc}', 500

app.run(port=5001)