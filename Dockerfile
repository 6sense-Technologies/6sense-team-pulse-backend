# Base image
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# A wildcard is used to ensure both package.json AND yarn.lock are copied
COPY package.json yarn.lock ./

# Install app dependencies
RUN yarn install --frozen-lockfile

# Bundle app source
COPY . .


# Creates a "dist" folder with the production build
RUN yarn build

# Expose the port on which the app will run
EXPOSE 8000

# Start the server using the production build
CMD ["yarn", "start:prod"]
