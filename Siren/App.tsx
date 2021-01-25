import { StatusBar } from 'expo-status-bar';
import { Audio, AVPlaybackStatus } from 'expo-av';
import React, { useEffect } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Permissions from 'expo-permissions';
import { usePermissions } from 'expo-permissions';
import { FileSystem } from 'expo';

export default function App() {
  const recordingSettings = Audio.RECORDING_OPTIONS_PRESET_LOW_QUALITY;
  let recording: Audio.Recording | null = null;
  let sound: Audio.Sound | null = null;

  const [recordingPermission, askForPermission] = usePermissions(Permissions.AUDIO_RECORDING, { ask: true });
  
  useEffect(() => {
    askForPermission()
  });

  const [ state, setState ] = React.useState({ 
    isLoading: false,
    isPlaybackAllowed: false,
    shouldPlay: false,
    isPlaying: false,
    isRecording: false 
  });

  const [buttonText, setButtonText] = React.useState({
    record: 'Record',
    playPause: 'Play'
  })

  function updateRecordingStatus(audioState: Audio.RecordingStatus){
    if (audioState.canRecord) {
      state.isRecording = audioState.isRecording;
      setState(state);
    } else if (audioState.isDoneRecording) {
      state.isRecording = false;
      setState(state);
      if (!state.isLoading) {
        stopRecordingAndEnablePlayback();
      }
    }
  }

  function updateSoundStatus(audioState: AVPlaybackStatus){
    if (audioState.isLoaded) {
      setState({
        ...state,
        shouldPlay: audioState.shouldPlay, 
        isPlaying: audioState.isPlaying, 
        isPlaybackAllowed: true
      });
    } else {
      setState({...state, isPlaybackAllowed: false});
      if (audioState.error) {
        console.log(`FATAL PLAYER ERROR: ${audioState.error}`);
      }
    }
  }

  async function stopAudioAndBeginRecording() {
    // if (!recordingPermission || recordingPermission.status !== 'granted') {
    //   askForPermission
    // }
    // state.isLoading = true;
    if(recordingPermission) console.log(recordingPermission.status);
    else console.log("no recording permission")
    setState({
      ...state,
      isLoading:true
    });
    if(sound !== null) {
      await sound.unloadAsync();
      sound.setOnPlaybackStatusUpdate(null);
      sound = null;
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
    });

    if (recording !== null) {
      recording.setOnRecordingStatusUpdate(null);
      recording = null;
    }
    console.log("creating new recording");
    const new_recording = new Audio.Recording();
    console.log(new_recording);
    console.log("start recording", recordingSettings);
    await new_recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
    console.log("derp");
    new_recording.setOnRecordingStatusUpdate(updateRecordingStatus);
    console.log("burp");
    recording = new_recording;
    await recording.startAsync(); // Will call this._updateScreenForRecordingStatus to update the screen.
    console.log("recording started");
    state.isLoading = false;
    setState(state);
  }

  async function stopRecordingAndEnablePlayback() {
    console.log("recording done... set up playback");
    setState({...state, isLoading: true});

    if (!recording) {
      return;
    }
    try {
      await recording.stopAndUnloadAsync();
    } catch(error) {
      if (error.code === "E_AUDIO_NODATA") {
        console.log(
          `no data recieved. Stop was called too fast. Error mssg (${error.message})`  
          );
      } else {
        console.log("STOP ERROR: ", error.code, " ", error.name, " ", error.message);
      }
      setState({...state, isLoading: false});
      return;
    }
    const audioInfo = await FileSystem.getInfoAsync(recording.getURI || "");
    console.log(`FILE INFO: ${JSON.stringify(audioInfo)}`);

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
    });
    console.log("create new audio file");
    const new_audio = await recording.createNewLoadedSoundAsync(
    {
      isLooping: true,
    },
    updateSoundStatus
    );
    sound = new_audio.sound;
    console.log("new audio ready");
    setState({...state, isLoading: false})
  }

  

  function onRecord() {
    if (state.isRecording) {
      setButtonText({...buttonText, record: 'Record'});
      stopRecordingAndEnablePlayback();
    } else {
      setButtonText({...buttonText, record: 'Recording Audio...'});
      stopAudioAndBeginRecording();
    }
  }

  function onPlayPausedPressed(){
    if (sound !== null){
      if (state.isPlaying) {
        setButtonText({...buttonText, playPause: 'Pause'});
        sound.pauseAsync();
      } else {
        setButtonText({...buttonText, playPause: 'Play'});
        sound.playAsync();
      }
    }
  }



  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        This is an Audio siren app. Tap record to begin recording and play to play what was recorded.
      </Text>
      <View style={styles.buttonLayout}>
        <TouchableOpacity style={styles.button} onPress={onRecord} activeOpacity = { .5 }>
          <Text style={styles.buttonText}>{buttonText.record}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={onPlayPausedPressed} activeOpacity = { .5 }>
          <Text style={styles.buttonText}>{buttonText.playPause}</Text>
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
