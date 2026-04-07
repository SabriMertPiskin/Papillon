import boto3

##DENEMEK ICIN http://127.0.0.1:8000/vm-lab/start-instance/
AWS_ACCESS_KEY = "AKIAxxxxxxxxxxxxxxxx"
AWS_SECRET_KEY = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
REGION = "eu-central-1"


def start_ec2_instance(instance_id, region=REGION):
    ec2 = boto3.client(
        "ec2",
        region_name=region,
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY
    )

    response = ec2.start_instances(
        InstanceIds=[instance_id]
    )

    state = response["StartingInstances"][0]["CurrentState"]["Name"]

    return {
        "instance_id": instance_id,
        "status": state,
        "message": "instance starting"
    }
    
# import boto3
# import time


# def start_ec2_instance(instance_id, region="eu-central-1"):
#     ec2 = boto3.client("ec2", region_name=region)

#     # instance start
#     ec2.start_instances(InstanceIds=[instance_id])

#     # IP hemen gelmeyebilir, biraz beklemek gerekir
#     time.sleep(10)

#     response = ec2.describe_instances(InstanceIds=[instance_id])

#     instance = response["Reservations"][0]["Instances"][0]

#     public_ip = instance.get("PublicIpAddress", None)
#     state = instance["State"]["Name"]

#     return {
#         "instance_id": instance_id,
#         "status": state,
#         "public_ip": public_ip
#     }