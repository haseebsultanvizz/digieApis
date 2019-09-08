FROM node:10


# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./
RUN node -v
RUN npm install
# If you are building your code for production

# Bundle app source
COPY . .


EXPOSE 3010
CMD [ "npm", "start" ]

