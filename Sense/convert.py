from os import path
from pydub import AudioSegment

# # files                                                                         
# src = "transcript.mp3"
# dst = "test.wav"

# # convert wav to mp3                                                            
# sound = AudioSegment.from_mp3(src)
# sound.export(dst, format="wav")


# files                                                                         
src = "test_audio/dog_bark_1.wav"
dst = "test_audio/dog_bark_1_mp3.mp3"

# convert mp3 to wav                                                            
sound = AudioSegment.from_wav(src)
sound.export(dst, format="mp3")
