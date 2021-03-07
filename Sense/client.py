import requests
# Test Script of server
# server url
# URL = "http://127.0.0.1:5000/predict_wav"


# # audio file we'd like to send for predicting keyword
# FILE_PATH = "test_audio/dog_bark_1.wav"


# if __name__ == "__main__":

#     # open files
#     file = open(FILE_PATH, "rb")

#     # package stuff to send and perform POST request
#     values = {"file": (FILE_PATH, file, "audio/wav")}
#     response = requests.post(URL, files=values)
#     data = response.json()

#     print("Predicted class: {}".format(data["predicted_class"]))

URL = "http://127.0.0.1:5000/predict_mp3"


# audio file we'd like to send for predicting keyword
FILE_PATH = "test_audio/dog_bark_1_mp3.mp3"


if __name__ == "__main__":

    # open files
    file = open(FILE_PATH, "rb")

    # package stuff to send and perform POST request
    values = {"file": (FILE_PATH, file, "audio/mp3")}
    response = requests.post(URL, files=values)
    data = response.json()

    print("Predicted class: {}".format(data["predicted_class"]))