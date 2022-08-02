# builds from node:14.18.0 (LTS as of 10-2021)
FROM node:16.7.0
# Create app directory
WORKDIR /home/node/app
# Change ownership to non-root user
RUN chown node:node /home/node/app
# Set user to non-root "node"
USER node
# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY --chown=node:node package.json ./
RUN npm install
# If you are building your code for production
# RUN npm ci --only=production
# Copy over app source
COPY --chown=node:node . ./
# Set environment variables
ENV NODE_ENV production

# Run default node app on startup (however, since this project supports various modes, this should be overriden
# in either the Docker CLI or Docker Compose in order to start the other modes.
CMD [ "npm","run","start"]
