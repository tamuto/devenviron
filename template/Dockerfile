FROM tamuto/devenviron:0.38.0

# Set working directory
WORKDIR /workspaces

# Copy any additional configuration files if needed
# COPY . /workspaces

# Set default user
USER root

# Add host.docker.internal mapping
RUN echo "host.docker.internal host-gateway" >> /etc/hosts || true