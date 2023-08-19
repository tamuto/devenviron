#!/bin/bash
instanceId=$(aws --profile $1 ec2 describe-instances --query "Reservations[*].Instances[*].InstanceId" --filters "Name=tag:Name,Values=[$2]" --output text)
[[ -z "$instanceId" ]] && { echo "Cannot get instanceId."; exit 1; }
ssh -oProxyCommand="aws --profile $1 ssm start-session --target ${instanceId} --document-name AWS-StartSSHSession --parameters 'portNumber=[22]'" -4 -L $3 $2 ${@:4}
