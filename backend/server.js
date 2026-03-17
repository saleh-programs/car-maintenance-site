//MAIN BACKEND FILE

import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import webpush from 'web-push';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config()

const app = express();

app.use(cors());
app.use(express.json());  
app.use(bodyParser.json())


const publicVapidKey = "BPRBR3516pFzNP8WufLyCXf2t_ahKLju7MYJgDujqQDmZeenz07sTMcCy_l5uzreTAJU47ZcD4k5fYjWMcP5-64";
webpush.setVapidDetails("mailto:test@test.com",publicVapidKey,process.env.privateVapidKey);

// ENDPOINTS

//subscribe to notifications 
app.post('/subscribe',(req,res) =>{

  // service worker needs subscription and data info
  const subscription = req.body;
  const info = JSON.stringify({title: 'Hey there!', body: "Testing your notification. Take good care of your car!"});

  // send notification
  webpush.sendNotification(subscription, info).catch(err => console.error(err));
  res.status(200).send("success")
});

//Validate user login and/or return user data
app.post('/checkusers',async (req,res) =>{

  //Call validate login method in Python Script
  const pyScript = spawn('python',['dataConnect.py','validLogin',req.body.user,req.body.pass])

  //Show output of Python Script. Output is one of:
  // 1) "No user found"
  // 2) "Wrong password"
  // 3) validated login, and sends user's data
  pyScript.stdout.on('data', (data) => {
    const info = data.toString().trim()
    if (info === "wrong password" || info ==="no user found"){
      res.status(404).send(info);
    }else{
      res.status(200).send(info);
    }
  });

  pythonErrorOrEnd(pyScript);
});

//Add a user login
app.post('/createuser',async (req,res)=>{

  //Call create user method in Python Script
  const pyScript = spawn('python',['dataConnect.py','createUser',req.body.user,req.body.pass])

  //Show output of Python Script.
  pyScript.stdout.on('data', (data) => {
    const info = data.toString().trim()
    if (info === "failed"){
      res.status(404).json({"status":info});
    }else{
      res.status(200).json({"status":info});
    }
  });
  pythonErrorOrEnd(pyScript);

})

//delete a user login
app.delete('/deleteuser',(req,res)=>{
  //Call create user method in Python Script
  const pyScript = spawn('python',['dataConnect.py','deleteUser',req.body.user])

  //Show output of Python Script.
  pyScript.stdout.on('data', (data) => {
    const info = data.toString().trim()
    if (info === "failed"){
      res.status(404).send({"status":info});
    }else{
      res.status(200).send({"status":info});
    }  });
  pythonErrorOrEnd(pyScript);

})

//modify user data
app.put('/modifyuser',(req,res)=>{
  //Call create user method in Python Script
  let result;
  const pyScript = spawn('python',['dataConnect.py','modifyUser',req.body.user,req.body.userdata])
  //Show output of Python Script.
  pyScript.stdout.on('data', (data) => {
    const info = data.toString().trim()
    if (info === "failed"){
      res.status(404).send(info);
    }else{
      res.status(200).send(info);
    }
  });
  pythonErrorOrEnd(pyScript);

})

// Obtain a business image for local services page from google's place API
app.post('/businessimage',async (req,res) =>{
    const shopLat = req.body.shopLat;
    const shopLon = req.body.shopLon;

    const google_api_key = process.env.GOOGLE_API_KEY;
    const imageID_JSONBody =  {
      "includedTypes": ["car_repair"],
      "maxResultCount": 1,
      "locationRestriction": {
      "circle": {
        "center": {
        "latitude": shopLat,
        "longitude": shopLon},
        "radius": 50.0
        }
      }
    }
    const imageIDResponse = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: 'POST',
      body: JSON.stringify(imageID_JSONBody),
      headers:{
        "Content-Type": "application/json",
        "X-Goog-Api-Key": google_api_key,
        "X-Goog-FieldMask": "places.photos"
      }
    })

    const imageIDResponseData = await imageIDResponse.json()
    const shopImageName = (imageIDResponseData.places && imageIDResponseData.places[0].photos) ? imageIDResponseData.places[0].photos[0].name : false
    
    const imageURL= shopImageName ? `https://places.googleapis.com/v1/${shopImageName}/media?key=${google_api_key}&maxWidthPx=250&maxHeightPx=400`: false;
    res.status(200).json({imageURL:imageURL});
  }
);

//display entries for debugging
app.get('/entries',(req,res)=>{
  //Call create user method in Python Script
  const pyScript = spawn('python',['dataConnect.py','showEntries'])
  //Show output of Python Script.
  pyScript.stdout.on('data', (data) => {
    res.json(data.toString())
  });
  pythonErrorOrEnd(pyScript);
})

// for customer support page
app.post('/groq', async (req, res) => {
  const info = req.body;
  const messages = [
    { role: 'system', content: "You are customer support for a car maintenance site called 'The Ultimate Car Maintenance Checklist'. "
      + "Please do not send messages that are too long, but not short either if a user expects some help. Do not use emojis often."},
    ...info.chatHistory.map(item => {
      return([
        {role: 'user', content: item[0]},
        {role: 'assistant', content: item[1]},
      ])
    }).flat(),
    { role: 'user', content: info.message }
  ];
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: messages
      })
    });
    const data = await response.json();
    res.status(200).json({ reply: data.choices[0].message.content });
  } catch (error) {
    console.error('Groq API error:', error);
    res.status(500).send('Error contacting Groq API');
  }
});

// Used in Physics Practice Game project. (I am reusing this backend)
app.post('/willow', async (req, res) => {
  const { chat_history, user_query } = req.body;

  const context = `You are Willow, a character in a game built by Murad to help people practice kinematics.
  The game has ended, and now the user can interact with you in a conversation. Willow is a volunteer
  and has had his TI-84 calculator stolen by a robber in many of the game’s levels. You hate him with a passion.
  Willow’s personality is somewhat childish, informal, and slightly rude, but he has a cool vibe and is generally
  reserved—he doesn’t speak much. The user is having a conversation with Willow, but please do not unnecessarily
  force this backstory into the dialogue, but the user expects you to acknowledge it. You are not an AI, you know
  only as much as this goofy Willow character`;

  const messages = [
    ...chat_history,
    { role: "system", content: context },
    { role: "user", content: user_query }
  ];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages
      })
    });

    const data = await response.json();
    res.json({ response: data.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});


function pythonErrorOrEnd(file){
  // For error in file & checking it closed (when I'm debugging)
  file.stderr.on('data', (data) => {
    console.error(`Python error: ${data.toString()}`);
  });
  file.on('close',(code)=>{
    console.log(`Python script finished with exit code ${code}`);
  })
}


app.listen(8000);
