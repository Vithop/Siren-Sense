# To add a new cell, type '# %%'
# To add a new markdown cell, type '# %% [markdown]'
# %%
import numpy as np
import pandas as pd
import librosa
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from pydub import AudioSegment
import random
from sklearn.preprocessing import LabelEncoder
import tensorflow as tf
import pprint
from tensorflow.keras.utils import to_categorical


app = Flask(__name__)
CORS(app)

# Quick Test
@app.route("/hello")
def hello():
    # data = "<h1 style='color:blue'>Hello There!</h1>"
    # return jsonify(data)
    return "<h1 style='color:blue'>Hello There!</h1>"


@app.route("/posttest")
def posttest():
    # data = "<h1 style='color:blue'>Hello There!</h1>"
    # return jsonify(data)
    pprint.pprint(request.data)
    pprint.pprint(request.form)
    return "<h1 style='color:green'>Hello There!</h1>"


@app.route("/predict_wav", methods=["POST"])
def siren_sense_predict_wav():

    max_pad_len = 174

    num_rows = 40
    num_columns = 174
    num_channels = 1

    # Convert into a Panda dataframe
    # featuresdf = pd.read_csv("server/flask/model/featuresdf.csv")
    featuresdf = pd.read_csv("model/featuresdf.csv")

    y = np.array(featuresdf.class_label.tolist())
    # print(y)

    # Encode the classification labels
    le = LabelEncoder()
    yy = to_categorical(le.fit_transform(y))

    # model = tf.keras.models.load_model('server/flask/model/siren_sense_model.hdf5')
    model = tf.keras.models.load_model("model/siren_sense_model.hdf5")
    # model.summary()

    audio_file = request.files["file"]
    file_name = str(random.randint(0, 1000000))
    audio_file.save(file_name)

    try:
        audio, sample_rate = librosa.load(file_name, res_type="kaiser_fast")
        mfccs = librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=40)
        pad_width = max_pad_len - mfccs.shape[1]
        mfccs = np.pad(mfccs, pad_width=((0, 0), (0, pad_width)), mode="constant")

    except Exception as e:
        print("Error encountered while parsing file: ", file_name)
        return None

    prediction_feature = mfccs
    prediction_feature = prediction_feature.reshape(
        1, num_rows, num_columns, num_channels
    )

    predicted_vector = model.predict_classes(prediction_feature)
    predicted_classes = le.inverse_transform(predicted_vector)
    # print("The predicted class is:", predicted_classes[0], '\n')

    predicted_class = predicted_classes[0]

    data = {"predicted_class": predicted_class}

    os.remove(file_name)
    return jsonify(data)


@app.route("/predict_mp3", methods=["POST"])
def siren_sense_predict_mp3():
    max_pad_len = 174

    num_rows = 40
    num_columns = 174
    num_channels = 1

    # Convert into a Panda dataframe
    # featuresdf = pd.read_csv("server/flask/model/featuresdf.csv")
    featuresdf = pd.read_csv("model/featuresdf.csv")

    y = np.array(featuresdf.class_label.tolist())
    # print(y)

    # Encode the classification labels
    le = LabelEncoder()
    yy = to_categorical(le.fit_transform(y))

    # model = tf.keras.models.load_model('server/flask/model/siren_sense_model.hdf5')
    model = tf.keras.models.load_model("model/siren_sense_model.hdf5")
    # model.summary()
    # pp = pprint.PrettyPrinter(indent=4, depth=5)
    # pp.pprint(request.data)
    # pp.pprint(request.headers)
    # pp.pprint(request.form)
    # pp.pprint(request.files)

    print("\n"*10)

    # return "test"
    audio_file = request.files["file"]
    file_name = str(random.randint(0, 1000000)) + ".mp3"
    print("generated file name")
    # print(audio_file)
    audio_file.save(file_name)
    print("saved file as " + file_name)
    # sound = AudioSegment.from_mp3(file_name)
    # print("got segment from mp3")
    # sound.export(file_name, format="mp3")

    try:
        audio, sample_rate = librosa.load(file_name, res_type="kaiser_fast")
        mfccs = librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=40)
        pad_width = max_pad_len - mfccs.shape[1]
        mfccs = np.pad(mfccs, pad_width=((0, 0), (0, pad_width)), mode="constant")

    except Exception as e:
        print("Error encountered while parsing file: ", file_name)
        print(e)
        return None

    prediction_feature = mfccs
    prediction_feature = prediction_feature.reshape(
        1, num_rows, num_columns, num_channels
    )

    predicted_vector = model.predict_classes(prediction_feature)
    predicted_classes = le.inverse_transform(predicted_vector)
    # print("The predicted class is:", predicted_classes[0], '\n')

    predicted_class = predicted_classes[0]

    data = {"predicted_class": predicted_class}
    print("\n\n\n\n\nPREDICTED CLASS")
    print(data)
    print("JSONIFY")
    print(jsonify(data))
    os.remove(file_name)
    return jsonify(data)
    # return app.response_class(
    #     response=jsonify(data), status=200, mimetype="application/json"
    # )

    # data = {"predicted_class": "BURP!"}
    # return jsonify(data)


if __name__ == "__main__":
    # app.run(debug=False)
    app.run(host="0.0.0.0", debug=True)
