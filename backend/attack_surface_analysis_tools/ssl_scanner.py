import datetime
import json as json_lib
from typing import Optional, Tuple
from sslyze import (
    Scanner,
    ServerScanRequest,
    ServerNetworkLocation,
    ServerScanStatusEnum,
    ServerScanResultAsJson,
    SslyzeOutputAsJson,
)
from datetime import timezone


def scan_ssl_cert(domain: str) -> Tuple[Optional[dict], Optional[bool]]:
    print(f"[DEBUG SSL] Starting SSL scan for {domain}")
    try:
        scan_reqs = [ServerScanRequest(server_location=ServerNetworkLocation(hostname=domain))]

        scanner = Scanner()
        scanner.queue_scans(scan_reqs)

        all_server_scan_results = []
        for server_scan_result in scanner.get_results():
            all_server_scan_results.append(server_scan_result)
            if server_scan_result.scan_status == ServerScanStatusEnum.ERROR_NO_CONNECTIVITY:
                print(f"[DEBUG SSL] No connectivity to {domain}")
                raise RuntimeError("TLS connectivity failed")

        started = datetime.datetime.now(timezone.utc)
        completed = datetime.datetime.now(timezone.utc)
        json_output = create_json_output(all_server_scan_results, started, completed)

        not_valid_after = all_server_scan_results[0].scan_result.certificate_info.result.certificate_deployments[0].received_certificate_chain[0].not_valid_after_utc
        now = datetime.datetime.now(timezone.utc)
        validity_status = now < not_valid_after

        result = json_lib.loads(json_output)
        print(f"[DEBUG SSL] Successfully scanned {domain}, valid: {validity_status}")
        return result, validity_status
    except Exception as e:
        print(f"[DEBUG SSL] Failed for {domain}: {e}")
        return None, None


def create_json_output(all_server_scan_results, date_scans_started, date_scans_completed) -> str:
    json_output = SslyzeOutputAsJson(
        server_scan_results=[ServerScanResultAsJson.model_validate(result) for result in all_server_scan_results],
        invalid_server_strings=[],
        date_scans_started=date_scans_started,
        date_scans_completed=date_scans_completed,
    )
    return json_output.model_dump_json()
    
