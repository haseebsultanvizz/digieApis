FROM node:10

# Create app directory
WORKDIR /usr/src/app

COPY package*.json ./
RUN node -v
RUN npm install
# If you are building your code for production

# Bundle app source
COPY . .


EXPOSE 3010
CMD [ "npm", "start" ]
