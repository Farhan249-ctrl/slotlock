// ==============================================================================
// SlotLock CI/CD Declarative Pipeline Specification
// ==============================================================================
// This Jenkinsfile automates the continuous integration and deployment workflow:
// 1. Checkout: Clones source repository from version control.
// 2. Backend Test: Boots ephemeral PostgreSQL test container and executes Maven test suite.
// 3. Frontend Build: Installs dependencies and builds the React 18 production bundle.
// 4. Build Images: Builds immutable Docker images for backend and frontend tagged with BUILD_NUMBER.
// 5. Push: Authenticates with Docker Registry using credentials binding and pushes versioned images.
// 6. Deploy: Connects via SSH to remote EC2 deployment host to update and restart the stack.
// 7. Verify: Health-checks public ingress through Nginx reverse proxy to confirm live deployment.
// ==============================================================================

pipeline {
    agent any

    environment {
        DOCKER_REGISTRY  = 'farhan249'
        BACKEND_IMAGE    = "${DOCKER_REGISTRY}/slotlock-backend"
        FRONTEND_IMAGE   = "${DOCKER_REGISTRY}/slotlock-frontend"
        DEPLOY_HOST      = 'ec2-deploy.slotlock.internal'
        DEPLOY_DIR       = '/opt/slotlock'
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
        ansiColor('xterm')
    }

    stages {
        // Stage 1: Checkout source code
        stage('Checkout') {
            steps {
                echo '=== Stage 1: Checking out source code ==='
                checkout scm
            }
        }

        // Stage 2: Backend tests against ephemeral Postgres container
        stage('Backend Test') {
            steps {
                echo '=== Stage 2: Executing backend test suite ==='
                dir('backend') {
                    sh '''
                        # Spin up ephemeral PostgreSQL test container
                        docker run -d --name jenkins-postgres-test \\
                            -e POSTGRES_DB=slotlock \\
                            -e POSTGRES_USER=slotlock \\
                            -e POSTGRES_PASSWORD=slotlock_dev_password \\
                            -p 5433:5432 \\
                            postgres:16

                        # Wait for database health
                        until docker exec jenkins-postgres-test pg_isready -U slotlock -d slotlock; do
                            sleep 2
                        done

                        # Run tests with environment variables configured for test container
                        POSTGRES_HOST=localhost \\
                        POSTGRES_PORT=5433 \\
                        POSTGRES_DB=slotlock \\
                        POSTGRES_USER=slotlock \\
                        POSTGRES_PASSWORD=slotlock_dev_password \\
                        JWT_SECRET=404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970 \\
                        ADMIN_EMAIL=admin@slotlock.local \\
                        ADMIN_PASSWORD=AdminPassword123! \\
                        ./mvnw clean test

                        # Cleanup ephemeral test container
                        docker rm -f jenkins-postgres-test
                    '''
                }
            }
        }

        // Stage 3: Frontend compilation and validation
        stage('Frontend Build') {
            steps {
                echo '=== Stage 3: Building frontend bundle ==='
                dir('frontend') {
                    sh '''
                        npm ci
                        npm run lint
                        npm run build
                    '''
                }
            }
        }

        // Stage 4: Build immutable Docker images tagged with BUILD_NUMBER
        stage('Build Images') {
            steps {
                echo "=== Stage 4: Building Docker images for build #${BUILD_NUMBER} ==="
                sh """
                    docker build -t ${BACKEND_IMAGE}:${BUILD_NUMBER} -t ${BACKEND_IMAGE}:latest ./backend
                    docker build -t ${FRONTEND_IMAGE}:${BUILD_NUMBER} -t ${FRONTEND_IMAGE}:latest ./frontend
                """
            }
        }

        // Stage 5: Push images to DockerHub using credentials binding
        stage('Push') {
            steps {
                echo '=== Stage 5: Pushing images to registry ==='
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh """
                        echo "\$DOCKER_PASS" | docker login -u "\$DOCKER_USER" --password-stdin
                        docker push ${BACKEND_IMAGE}:${BUILD_NUMBER}
                        docker push ${BACKEND_IMAGE}:latest
                        docker push ${FRONTEND_IMAGE}:${BUILD_NUMBER}
                        docker push ${FRONTEND_IMAGE}:latest
                        docker logout
                    """
                }
            }
        }

        // Stage 6: Deploy to EC2 host via SSH
        stage('Deploy') {
            steps {
                echo '=== Stage 6: Deploying to remote Docker host ==='
                withCredentials([sshUserPrivateKey(
                    credentialsId: 'ec2-ssh',
                    keyFileVariable: 'SSH_KEY',
                    usernameVariable: 'SSH_USER'
                )]) {
                    sh """
                        ssh -o StrictHostKeyChecking=no -i "\$SSH_KEY" "\$SSH_USER@${DEPLOY_HOST}" '
                            set -e
                            cd ${DEPLOY_DIR}
                            git pull origin main
                            docker compose pull
                            docker compose up -d --build --remove-orphans
                        '
                    """
                }
            }
        }

        // Stage 7: Verify live application through Nginx reverse proxy
        stage('Verify') {
            steps {
                echo '=== Stage 7: Verifying live deployment via Nginx ingress ==='
                withCredentials([sshUserPrivateKey(
                    credentialsId: 'ec2-ssh',
                    keyFileVariable: 'SSH_KEY',
                    usernameVariable: 'SSH_USER'
                )]) {
                    sh """
                        ssh -o StrictHostKeyChecking=no -i "\$SSH_KEY" "\$SSH_USER@${DEPLOY_HOST}" '
                            set -e
                            echo "Waiting for all containers to report healthy..."
                            for i in {1..30}; do
                                if [ "\$(docker inspect --format="{{.State.Health.Status}}" slotlock-nginx 2>/dev/null)" = "healthy" ] && \\
                                   [ "\$(docker inspect --format="{{.State.Health.Status}}" slotlock-backend 2>/dev/null)" = "healthy" ]; then
                                    echo "All services healthy!"
                                    break
                                fi
                                sleep 3
                            done

                            # Verify HTTP redirect to HTTPS
                            curl -k -I http://localhost | grep -i "301 Moved"

                            # Verify HTTPS responds with application root HTML
                            curl -k https://localhost/ | grep -i "SlotLock"

                            # Verify API requires authentication (HTTP 401)
                            STATUS=\$(curl -k -s -o /dev/null -w "%{http_code}" https://localhost/api/halls)
                            if [ "\$STATUS" -ne 401 ]; then
                                echo "Expected HTTP 401 from /api/halls, got \$STATUS"
                                exit 1
                            fi
                            echo "Deployment successfully verified through Nginx!"
                        '
                    """
                }
            }
        }
    }

    post {
        failure {
            echo "Pipeline FAILED on stage: ${STAGE_NAME}. Check console output for diagnosis."
        }
        always {
            cleanWs cleanWhenAborted: true, cleanWhenFailure: true, cleanWhenNotBuilt: true, cleanWhenSuccess: true, cleanWhenUnstable: true, deleteDirs: true
        }
    }
}
