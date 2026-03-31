from flask import Flask
import subprocess

app = Flask(__name__)

VBOX = r"C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
VM_NAME = "django-kali"

@app.route("/start-vm")
def start_vm():
    subprocess.Popen([
        VBOX,
        "startvm",
        VM_NAME,
        "--type",
        "gui"
    ])
    return "django-kali started"

@app.route("/stop-vm")
def stop_vm():
    subprocess.Popen([
        VBOX,
        "controlvm",
        VM_NAME,
        "acpipowerbutton"
    ])
    return "django-kali stopping"

app.run(port=5001)