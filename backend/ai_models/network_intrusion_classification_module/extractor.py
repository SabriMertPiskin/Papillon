import sys, time, requests
from cicflowmeter.sniffer import create_sniffer

TARGET_IP = sys.argv[1] # Terminalden girilen IP
API_URL = "http://127.0.0.1:8000/predict/"

# Modelin beklediği 48 özelliğin tam listesi
MODEL_FEATURES = [
    'Destination Port', 'Flow Duration', 'Total Fwd Packets', 'Total Length of Fwd Packets',
    'Total Length of Bwd Packets', 'Fwd Packet Length Max', 'Fwd Packet Length Min',
    'Fwd Packet Length Mean', 'Fwd Packet Length Std', 'Bwd Packet Length Max',
    'Bwd Packet Length Min', 'Flow Bytes/s', 'Flow Packets/s', 'Flow IAT Mean',
    'Flow IAT Min', 'Fwd IAT Mean', 'Fwd IAT Min', 'Bwd IAT Total', 'Bwd IAT Mean',
    'Bwd IAT Min', 'Fwd PSH Flags', 'Bwd PSH Flags', 'Fwd URG Flags', 'Bwd URG Flags',
    'Bwd Packets/s', 'Min Packet Length', 'Packet Length Variance', 'FIN Flag Count',
    'RST Flag Count', 'PSH Flag Count', 'ACK Flag Count', 'URG Flag Count',
    'CWE Flag Count', 'ECE Flag Count', 'Down/Up Ratio', 'Fwd Avg Bytes/Bulk',
    'Fwd Avg Packets/Bulk', 'Fwd Avg Bulk Rate', 'Bwd Avg Bytes/Bulk',
    'Bwd Avg Packets/Bulk', 'Bwd Avg Bulk Rate', 'Init_Win_bytes_forward',
    'Init_Win_bytes_backward', 'min_seg_size_forward', 'Active Mean', 'Active Std',
    'Active Min', 'Idle Std'
]

def process_flow(flow):
    if flow.dst_ip == TARGET_IP:
        data = flow.get_data()
        # 48 özelliği sıraya diz
        features = [float(data.get(f, 0)) for f in MODEL_FEATURES]
        # API'ye gönder
        requests.post(API_URL, json={"features": features})

sniffer = create_sniffer(input_interface=None, process_flow=process_flow)
sniffer.start()
time.sleep(1) 
sniffer.stop()