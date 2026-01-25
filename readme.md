# What is this project?

This is a discord bot made to update roles in Hypixel Skyblock related servers. It fetches fresh guild data from the official API, then compares them with the current server roles, and updates if changes needed.

## Technologies Used

JavaScript

## Step by step running guide

Firstly, download NPM and Node.js from official sources      
Secondly, create a file in this folder named .env with these contents:  

SUPABASE_URL = xxxxx  
SUPABASE_SERVICE_ROLE_KEY = xxxxx  
HYPIXEL_API_KEY = xxxxx --> Get from hypixel developer portal (needs to be refreshed every day)    

Finally, run by typing: node script.js

### For duplicating:

Database Schema: Coming Soon