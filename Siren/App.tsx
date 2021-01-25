import { StatusBar } from 'expo-status-bar';
import { Audio, AVPlaybackStatus } from 'expo-av';
import React, { useEffect } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Permissions from 'expo-permissions';
import { usePermissions } from 'expo-permissions';
import { FileSystem } from 'expo';

export default function App() {
  const recordingSettings = Audio.RECORDING_OPTIONS_PRESET_LOW_QUALITY;
  // let recording: Audio.Recording | null = null;
  // let sound: Audio.Sound | null = null;

  const [recordingPermission, askForPermission] = usePermissions(Permissions.AUDIO_RECORDING, { ask: true });
  
  useEffect(() => {
    askForPermission()
  });

  const [recording, setRecording] = React.useState<Audio.Recording | undefined>(undefined);
  const [sound, setAudio] = React.useState<Audio.Sound | undefined>(undefined);

  const [ state, setState ] = React.useState({ 
    isLoading: false,
    isPlaybackAllowed: false,
    shouldPlay: false,
    isPlaying: false,
    isRecording: false 
  });

  const [buttonText, setButtonText] = React.useState({
    record: 'Start Recording',
    playPause: 'Play'
  })

  // function updateRecordingStatus(audioState: Audio.RecordingStatus){
  //   if (audioState.canRecord) {
  //     setState({...state, isRecording: audioState.isRecording});
  //   } else if (audioState.isDoneRecording) {
  //     setState({...state, isRecording: false});
  //     if (!state.isLoading) {
  //       stopRecordingAndEnablePlayback();
  //     }
  //   }
  // }

  function updateSoundStatus(audioState: AVPlaybackStatus){
    if (audioState.isLoaded) {
      if (audioState.isPlaying) {
        console.log("is playing");
        setButtonText({...buttonText, playPause: 'Pause'});
      } else {
        console.log("not   playing");
        setButtonText({...buttonText, playPause: 'Play'});
      }
      if (audioState.didJustFinish) {
        console.log("audio finished playing")
        sound?.setPositionAsync(0);
      }
    } else {
      setState({...state, isPlaybackAllowed: false});
      if (audioState.error) {
        console.log(`FATAL PLAYER ERROR: ${audioState.error}`);
      }
    }
  }

  async function beginRecording() {
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
    if(sound !== undefined) {
      await sound.unloadAsync();
      sound.setOnPlaybackStatusUpdate(null);
      setAudio(undefined);
    }
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });
  
      // if (recording !== undefined) {
      //   recording.setOnRecordingStatusUpdate(null);
      //   setRecording(undefined);
      // }
      console.log('Starting recording..');
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await recording.startAsync(); 
      setRecording(recording);
      console.log('Recording started');
      setState({...state, isLoading: false});

    } catch (err) {
      console.error('Failed to start recording', err);
      // setState({...state, isRecording: false});
    }
   
  }

  async function stopRecording() {
    console.log("recording status:",recording !== undefined, "attempting to stop recording");
    // console.log(recording)
    setState({...state, isLoading: true});
    
    if (!recording) {
      return;
    }
    try {
      setRecording(undefined);
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
    // const audioInfo = await FileSystem.getInfoAsync(recording.getURI || "");
    // console.log(`FILE INFO: ${JSON.stringify(audioInfo)}`);

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
    const new_audio = await recording.createNewLoadedSoundAsync({}, updateSoundStatus);
    setAudio(new_audio.sound);
    console.log("new audio ready");
    setState({...state, isLoading: false})
  }

  


  function onPlayPausedPressed(){
    if (sound !== undefined){
      if (state.isPlaying) {
        console.log("pause audio");
        setButtonText({...buttonText, playPause: 'Pause'});
        sound.pauseAsync();
      } else {
        console.log("play audio");
        setButtonText({...buttonText, playPause: 'Play'});
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
        <TouchableOpacity style={styles.button} onPress={recording ? stopRecording : beginRecording} activeOpacity = { .5 }>
          <Text style={styles.buttonText}>{recording ? 'Stop Recording' : 'Begin Recording'}</Text>
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
    backgroundColor: '#aaa',
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
