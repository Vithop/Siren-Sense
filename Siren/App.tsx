import { Audio, AVPlaybackStatus } from 'expo-av';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, SafeAreaView, Platform, StatusBar } from 'react-native';
import * as Permissions from 'expo-permissions';
import { usePermissions } from 'expo-permissions';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import serverIp from './serverIP';

import {
	RecordingOptions,
	RecordingStatus,
	RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
	RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
	RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
	RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC
} from 'expo-av/build/Audio';

export const RECORDING_OPTIONS_PRESET_HIGH_QUALITY: RecordingOptions = {
	android: {
		extension: '.mp4',
		outputFormat: RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
		audioEncoder: RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC
	},
	ios: {
		extension: '.mp4',
		outputFormat: RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
		audioQuality: RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
		sampleRate: 44100,
		numberOfChannels: 1,
		bitRate: 128000
	}
};

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldPlaySound: true,
		shouldSetBadge: false
	})
});

async function sendPushNotification(message: object) {
	// console.log(message);
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
			vibrationPattern: [0, 250, 250, 250],
			lightColor: '#FF231F7C'
		});
	}

	return token;
}

const MAX_AUDIO_LEN_MILLIS = 3000;
var recording: Audio.Recording | undefined = undefined;
var sound: Audio.Sound | undefined = undefined;
var timer: NodeJS.Timeout | null = null;
var recordCount: number = 0;

export default function App() {
	// Notification
	const [expoPushToken, setExpoPushToken] = useState('');
	const [recordingPermission, askForPermission] = usePermissions(Permissions.AUDIO_RECORDING, { ask: true });

	useEffect(() => {
		askForPermission();
	});
	useEffect(() => {
		registerForPushNotificationsAsync().then((token) => setExpoPushToken(token));
	}, []);

	const [isRecording, setIsRecording] = React.useState<Boolean>(false);
	const [recordingBuffer, bufferAudio] = React.useState<Audio.Recording | undefined>(undefined);
	const [isPlaying, setIsPlaying] = React.useState(false);
	const [predictedAudio, updatePredictedAudio] = React.useState('');
	const [recordOnLoop, setRecordOnLoop] = React.useState<boolean>(false);


	async function updateSoundStatus(audioState: AVPlaybackStatus) {
		if (audioState.isLoaded) {
			setIsPlaying(audioState.isPlaying);
			// console.log("is audio playing?: ", audioState.isPlaying);
		} else if (audioState.error) {
			console.log(`FATAL PLAYER ERROR: ${audioState.error}`);
		}
	}

	async function classifyAudio(recording: Audio.Recording) {
		if (recording) {
			const uri = recording.getURI() ?? '';
			// console.log('send audio: ' + recording);
			// console.log('audio uri: ' + uri);

			const URL = `http://${serverIp}/predict_mp4`;
			const prediction = await FileSystem.uploadAsync(URL, uri, {
				headers: { 'Content-Type': 'multipart/form-data' },
				httpMethod: 'POST',
				uploadType: FileSystem.FileSystemUploadType.MULTIPART,
				fieldName: 'file',
				mimeType: 'audio/mp4'
			})
				.then((response) => JSON.parse(response.body).predicted_class)
				.catch((error) => console.log(error));

			console.log(`Prediction received: ${prediction}`);
			updatePredictedAudio(prediction);
			await sendPushNotification({
				to: expoPushToken,
				sound: 'default',
				title: prediction,
				body: `Predicted class is "${prediction}"`,
				autoDismiss: true
			});
			return prediction;
		}
	}

	async function beginRecording() {
		setIsRecording(true);
		recordCount++;

		if (!recordingPermission || recordingPermission.status !== 'granted') {
			askForPermission;
		}

		if (sound !== undefined) {
			await sound.unloadAsync();
			sound.setOnPlaybackStatusUpdate(null);
			sound = undefined;
		}
		try {
			//look into calling setModeAsync outside in an init function
			await Audio.setAudioModeAsync({
				allowsRecordingIOS: true,
				interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
				playsInSilentModeIOS: true,
				interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
				shouldDuckAndroid: true,
				staysActiveInBackground: true
			});

			console.log('Starting recording..');
			const new_recording = new Audio.Recording();
			await new_recording.prepareToRecordAsync(RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
			await new_recording.startAsync();
			recording = new_recording;

			console.log('Recording started');
		} catch (err) {
			console.error('Failed to start recording', err);
		}
	}

	async function stopRecording() {
		setIsRecording(false);
		console.log('recording status:', recording !== undefined);

		if (recording === undefined) {
			return;
		}
		try {
			bufferAudio(recording);
			await recording.stopAndUnloadAsync();
		} catch (error) {
			if (error.code === 'E_AUDIO_NODATA') {
				console.log(`no data recieved. Stop was called too fast. Error mssg (${error.message})`);
			} else {
				console.log('STOP ERROR: ', error.code, ' ', error.name, ' ', error.message);
			}
			return;
		}

		await Audio.setAudioModeAsync({
			allowsRecordingIOS: true,
			interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
			playsInSilentModeIOS: true,
			interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
			staysActiveInBackground: true
		});

		console.log('create new audio object');
		let { sound: newSound } = await recording.createNewLoadedSoundAsync({ isLooping: true }, updateSoundStatus);
		sound = newSound;
		console.log('new audio ready');

		await classifyAudio(recording);
		recording = undefined;
		recordCount--;
	}

	async function recordForDuration() {
		if (recordCount == 0) {
			console.log("Begin recording Loop")
			await beginRecording();
			await new Promise(resolve => setTimeout(resolve, MAX_AUDIO_LEN_MILLIS));
			await stopRecording();
			console.log("finished a 3sec recording")
		} else if (recordOnLoop) {
			recordForDuration();
		}
	}

	async function toggleRecordOnLoop() {
		setRecordOnLoop(!recordOnLoop);

		if (!recordOnLoop && timer == null) {
			timer = setInterval(recordForDuration, 3500);
		} else if (timer != null) {
			clearInterval(timer);
			timer = null;
		}
	}

	function onPlayPausedPressed() {
		if (sound !== undefined) {
			if (isPlaying) {
				sound.pauseAsync();
			} else {
				sound.playAsync();
			}
		} else {
			console.log('sound is undefined');
		}
	}

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.buttonLayout}>
				<TouchableOpacity
					style={styles.button}
					onPress={() => { isRecording ? stopRecording() : beginRecording() }}
					activeOpacity={0.5}
				>
					<Text style={styles.buttonText}>{isRecording ? 'Stop Recording' : 'Begin Recording'}</Text>
				</TouchableOpacity>
				<TouchableOpacity style={styles.button} onPress={() => { toggleRecordOnLoop() }} activeOpacity={0.5}>
					<Text style={styles.buttonText}>{recordOnLoop ? "Stop Recording Loop" : "Start Recording Loop"}</Text>
				</TouchableOpacity>
				<TouchableOpacity style={styles.button} onPress={onPlayPausedPressed} activeOpacity={0.5}>
					<Text style={styles.buttonText}>{isPlaying ? 'Pause' : 'Play'}</Text>
				</TouchableOpacity>
				<TouchableOpacity style={styles.button} onPress={() => { classifyAudio(recordingBuffer) }} activeOpacity={0.5}>
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
				<Text style={styles.title}>We currently sense: {predictedAudio == undefined ? "undefined" : predictedAudio}</Text>
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
