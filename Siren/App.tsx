import { Audio, AVPlaybackStatus } from 'expo-av';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, SafeAreaView, Platform, StatusBar } from 'react-native';
import * as Permissions from 'expo-permissions';
import { usePermissions } from 'expo-permissions';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import {
  RecordingOptions,
  RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
  RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
  RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
  RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC
} from 'expo-av/build/Audio';

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

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldPlaySound: true,
		shouldSetBadge: false
	})
});

async function sendPushNotification(message: object) {
  console.log(message);
	await fetch('https://exp.host/--/api/v2/push/send', {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Accept-encoding': 'gzip, deflate',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(message)
	});
}

async function registerForPushNotificationsAsync() {
	let token;
	if (Constants.isDevice) {
		const { status: existingStatus } = await Notifications.getPermissionsAsync();
		let finalStatus = existingStatus;
		if (existingStatus !== 'granted') {
			const { status } = await Notifications.requestPermissionsAsync();
			finalStatus = status;
		}
		if (finalStatus !== 'granted') {
			alert('Failed to get push token for push notification!');
			return;
		}
		token = (await Notifications.getExpoPushTokenAsync()).data;
		console.log(token);
	} else {
		alert('Must use physical device for Push Notifications');
	}

	if (Platform.OS === 'android') {
		Notifications.setNotificationChannelAsync('default', {
			name: 'default',
			importance: Notifications.AndroidImportance.MAX,
			vibrationPattern: [ 0, 250, 250, 250 ],
			lightColor: '#FF231F7C'
		});
	}

	return token;
}

export default function App() {
	// Notification
	const [ expoPushToken, setExpoPushToken ] = useState('');
  const [recordingPermission, askForPermission] = usePermissions(Permissions.AUDIO_RECORDING, { ask: true });

  useEffect(() => {
    askForPermission()
  });
	useEffect(() => {
		registerForPushNotificationsAsync().then((token) => setExpoPushToken(token));
	}, []);

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

    if (recordingBuffer) {
      const uri = recordingBuffer.getURI() ?? '';
      console.log("send audio: " + recordingBuffer);
      console.log("audio uri: " + uri);

      const response = await FileSystem.uploadAsync(URL, uri,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: 'audio/mp4'
        })
        .then(response => console.log("response: " + JSON.stringify(response)))
        .then(data => data)
        .catch(error => console.log(error));

        console.log("Data:");
        console.log(response);
        
        // await sendPushNotification({
        //   to: expoPushToken,
        //   sound: 'default',
        //   title: response.predicted_class,
        //   body: 'Predicted class is ' + response.predicted_class,
        //   autoDismiss: true
        // });
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
		<SafeAreaView style={styles.container}>
			<View style={styles.buttonLayout}>
				<TouchableOpacity
					style={styles.button}
					onPress={recording ? stopRecording : beginRecording}
					activeOpacity={0.5}
				>
					<Text style={styles.buttonText}>{recording ? 'Stop Recording' : 'Begin Recording'}</Text>
				</TouchableOpacity>
				<TouchableOpacity style={styles.button} onPress={onPlayPausedPressed} activeOpacity={0.5}>
					<Text style={styles.buttonText}>{isPlaying ? 'Pause' : 'Play'}</Text>
				</TouchableOpacity>
				<TouchableOpacity style={styles.button} onPress={classifyAudio} activeOpacity={0.5}>
					<Text style={styles.buttonText}>Send Audio</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={styles.button}
					onPress={async () => {
						await sendPushNotification({
							to: expoPushToken,
							sound: 'default',
							title: 'Original Title',
							body: 'And here is the body!',
							data: { someData: 'goes here' },
							autoDismiss: true
						});
					}}
					activeOpacity={0.5}
				>
					<Text style={styles.buttonText}>Test Notification</Text>
				</TouchableOpacity>
				<Text style={styles.title}>Your expo push token: {expoPushToken}</Text>
			</View>
		</SafeAreaView>
  );
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#171717',
		alignItems: 'center',
		justifyContent: 'center',
		paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
	},
	title: {
		color: '#fff',
		fontSize: 18,
		marginVertical: 15,
		textAlign: 'center'
	},
	button: {
		backgroundColor: '#007AFF',
		justifyContent: 'center',
		alignItems: 'center',
		flexDirection: 'row',
		borderRadius: 5,
		padding: 16,
		height: 50,
		marginTop: 10
	},
	buttonText: {
		fontSize: 20,
		color: '#fff',
		textAlign: 'center'
	},
	buttonLayout: {
		flexDirection: 'column',
		// justifyContent: 'space-between'
		marginLeft: 50,
		marginRight: 50,
		minWidth: 250
	}
});
