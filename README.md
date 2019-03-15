## AWS ECS FARGATE CICD pipeline  with Jenkins CodeCommit

### Intro
Here is a guide for ECS Fargate and Jenkins CICD

### Launch the template
Launch the cf.yaml . It is a sample nodejs application. Tested ALB endpoint http://{alb}/10001/api/fn to see the service is running successfully.

### Create a codecommit new repo
1. create a new repo in codecommit
2. create a IAM user for git user, add codecommitfull access for git push, pull....  https://docs.aws.amazon.com/codecommit/latest/userguide/setting-up-gc.html?icmpid=docs_acc_console_connect_np
3. under IAM user, create Git Credentials , this is the login during the git clone

## Setup Jenkins EC2
1. Launch a t3 small ec2
2. Associate a EIP to the EC2
3. Security group - inbound 8080 port 0.0.0.0/0
4. sudo yum update –y
5. sudo yum install java
6. sudo wget -O /etc/yum.repos.d/jenkins.repo http://pkg.jenkinsci.org/redhat/jenkins.repo
7.  sudo rpm --import https://pkg.jenkins.io/redhat/jenkins.io.key
8. sudo yum install jenkins -y
9. sudo service jenkins start
10. Visit to the Jenkins {EIP}:8080
11. Follow the setup guide
12. Install Plugins
13. CloudBees Docker Build and Publish plugin, Slack Notification Plugin, SQS Trigger plugin
14. sudo yum install git -y
15. sudo amazon-linux-extras install docker
16. sudo usermod -a -G docker ec2-user
17. sudo usermod -a -G docker jenkins
18. sudo service jenkins restart
19. sudo service docker start
20. Grant the IAM access to the EC2 role, i.e. Codecommit, ECR

## Setup Jenkins project
### API
1. New project, freestyle
2. Source Code Management , set the repo url and credential
3. (Optional) Build triggers with Amazon SQS , set the "SQS queue to monitor"
4. Build step 1 - Execute shell
#!/bin/bash
DOCKER_LOGIN=`aws ecr get-login --no-include-email --region us-west-2`
${DOCKER_LOGIN}
echo $GIT_COMMIT
5. Build step 2 - Docker build and Publish. Configure as repo, tag, docker registry url.
6. Post build - Execute shell, run command to udpate the cloudformation img

#!/bin/bash
AWSREGION=us-west-2
CFFILE=cf.yaml
CFSTACKNAME={stack name}
ImgSvc10001={account id}.dkr.ecr.us-west-2.amazonaws.com/svc-10001:$GIT_COMMIT

aws cloudformation update-stack --template-body file://$CFFILE  --parameters ParameterKey=SubnetId,ParameterValue=subnet-xxxxxx\\,subnet-xxxxxx\\,subnet-xxxxxx ParameterKey=VpcId,ParameterValue=vpc-xxxxxx	 ParameterKey=ImgSvc10001,ParameterValue=$ImgSvc10001  --capabilities CAPABILITY_IAM --stack-name $CFSTACKNAME --region $AWSREGION

Detail guide here
https://d1.awsstatic.com/Projects/P5505030/aws-project_Jenkins-build-server.pdf
