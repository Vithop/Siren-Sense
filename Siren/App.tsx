import { Audio, AVPlaybackStatus } from 'expo-av';
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Permissions from 'expo-permissions';
import { usePermissions } from 'expo-permissions';
import * as FileSystem from 'expo-file-system';
import {
  RecordingOptions,
  RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
  RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
  RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
  RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC
} from 'expo-av/build/Audio';
import { FileSystemUploadType } from 'expo-file-system';

export const RECORDING_OPTIONS_PRESET_HIGH_QUALITY: RecordingOptions = {
  android: {
    extension: '.mp4',
    outputFormat: RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
    audioEncoder: RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
  },
  ios: {
    extension: '.mp4',
    outputFormat: RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
    audioQuality: RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
};

export default function App() {
  const [recordingPermission, askForPermission] = usePermissions(Permissions.AUDIO_RECORDING, { ask: true });
  useEffect(() => {
    askForPermission()
  });


  const [recording, setRecording] = React.useState<Audio.Recording | undefined>(undefined);
  const [recordingBuffer, bufferAudio] = React.useState<Audio.Recording | undefined>(undefined);
  const [sound, setAudio] = React.useState<Audio.Sound | undefined>(undefined);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const URL = "http://192.168.0.115:5000/predict_mp4";

  async function updateSoundStatus(audioState: AVPlaybackStatus) {
    if (audioState.isLoaded) {
      setIsPlaying(audioState.isPlaying);
      // console.log("is audio playing?: ", audioState.isPlaying);
    } else if (audioState.error) {
      console.log(`FATAL PLAYER ERROR: ${audioState.error}`);
    }
  }

  async function classifyAudio() {

    if (recordingBuffer && recordingBuffer != null) {
      const uri = recordingBuffer.getURI() ?? '';
      console.log("send audio: " + recordingBuffer);
      console.log("audio uri: " + uri);

      FileSystem.uploadAsync(URL, uri,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          httpMethod: 'POST',
          uploadType: FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: 'audio/mp4'
        })
        .then(response => console.log("response: " + JSON.stringify(response)))
        .then(data => console.log("data: " + data))
        .catch(error => console.log(error));

    }
  }

  async function beginRecording() {
    if (!recordingPermission || recordingPermission.status !== 'granted') {
      askForPermission
    }

    if (sound !== undefined) {
      await sound.unloadAsync();
      sound.setOnPlaybackStatusUpdate(null);
      setAudio(undefined);
    }
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
        shouldDuckAndroid: true,
        staysActiveInBackground: true,
      });

      console.log('Starting recording..');
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await recording.startAsync();
      setRecording(recording);
      console.log('Recording started');

    } catch (err) {
      console.error('Failed to start recording', err);
    }

  }

  async function stopRecording() {
    console.log("recording status:", recording !== undefined, "attempting to stop recording");
    // console.log(recording)

    if (!recording) {
      return;
    }
    try {
      bufferAudio(recording);
      setRecording(undefined);
      await recording.stopAndUnloadAsync();
    } catch (error) {
      if (error.code === "E_AUDIO_NODATA") {
        console.log(`no data recieved. Stop was called too fast. Error mssg (${error.message})`);
      } else {
        console.log("STOP ERROR: ", error.code, " ", error.name, " ", error.message);
      }
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      playsInSilentModeIOS: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      staysActiveInBackground: true,
    });

    console.log("create new audio object");
    const new_audio = await recording.createNewLoadedSoundAsync({ isLooping: true }, updateSoundStatus);
    setAudio(new_audio.sound);
    console.log("new audio ready");

  }

  function onPlayPausedPressed() {
    if (sound !== undefined) {
      if (isPlaying) {
        sound.pauseAsync();
      } else {
        sound.playAsync();
      }
    } else {
      console.log("sound is undefined");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        This is an Audio siren app. Tap record to begin recording and play to play what was recorded.
      </Text>
      <View style={styles.buttonLayout}>
        <TouchableOpacity style={styles.button} onPress={recording ? stopRecording : beginRecording} activeOpacity={.5}>
          <Text style={styles.buttonText}>{recording ? 'Stop Recording' : 'Begin Recording'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={onPlayPausedPressed} activeOpacity={.5}>
          <Text style={styles.buttonText}>{isPlaying ? 'Pause' : 'Play'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={classifyAudio} activeOpacity={0.5}>
          <Text style={styles.buttonText}>Send Audio</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  title: {
    color: '#888',
    fontSize: 18,
    marginVertical: 15,
    textAlign: 'center',
  },
  button: {
    backgroundColor: "blue",
    padding: 20,
    borderRadius: 5,
  },
  buttonText: {
    fontSize: 20,
    color: '#fff',
  },
  buttonLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  }
});
