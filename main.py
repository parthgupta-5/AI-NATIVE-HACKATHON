from flask import Flask, request, send_file, render_template, jsonify
import os

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/photoelectric")
def photoelectric():
    return render_template("photoelectric.html")

@app.route("/generate", methods=["POST"])
def generate():
    try:
        data = request.get_json()
        user_input = data.get("prompt", "").lower().strip()

        if "astronaut" in user_input:
            path = os.path.join("static", "models", "astronaut.glb")

        elif "table" in user_input:
            path = os.path.join("static", "models", "table.glb")

        elif "phone" in user_input:
            path = os.path.join("static", "models", "phone.glb")

        elif "blackhole" in user_input:
            path = os.path.join("static", "models", "blackhole.glb")

        else:
            return jsonify({"error": "Only astronaut, table, phone, or blackhole supported"}), 400

        if not os.path.exists(path):
            return jsonify({"error": "Model file not found"}), 500

        return send_file(path, mimetype="model/gltf-binary")

    except Exception as e:
        return jsonify({"error": str(e)}), 500