# 🚀 3D Model Hackathon

A simple web app that dynamically loads 3D GLB models based on user text input.

## 🧠 Idea

User enters a prompt like:

•⁠  ⁠astronaut  
•⁠  ⁠table  
•⁠  ⁠phone  
•⁠  ⁠blackhole  

The backend (Flask) matches the keyword and returns the corresponding ⁠ .glb ⁠ file.  
The frontend (Three.js) loads and renders the model in the browser.

---

## 🛠 Tech Stack

•⁠  ⁠Python (Flask)
•⁠  ⁠HTML / CSS / JavaScript
•⁠  ⁠Three.js
•⁠  ⁠GLB (glTF Binary)
•⁠  ⁠Vercel (Deployment)

---

## ⚙️ How It Works

1.⁠ ⁠User enters a prompt
2.⁠ ⁠Frontend sends POST request to ⁠ /generate ⁠
3.⁠ ⁠Flask selects the correct model
4.⁠ ⁠GLB file is returned
5.⁠ ⁠Three.js renders the model

---
