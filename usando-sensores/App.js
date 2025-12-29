import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Alert,
  FlatList,
  Switch,
  StatusBar,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { NavigationContainer, useNavigation, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { themes, translations, createStyles } from './assets/theme';

import {

  startSensorServices,
  stopSensorServices,
  getSensorData,
  getSensorStatus,
  
  // Sound util
  initSoundService,
  playSound,
  SOUND_TYPES,
  setSoundEnabledState,
  
  // Challenge utilities
  generateChallenge,
  resetChallengeTracking,
  verifyChallengeCompletion,
  CHALLENGE_TYPES,
  
  // Storage utilities
  saveChallenge,
  getHistory,
  clearHistory,
  getDifficultySettings,
  setDifficultySettings,
  getTheme,
  setTheme,
  getLanguage,
  setLanguage
} from './utils/utils';

// ==================== CONTEXT API ====================
// Create AppContext
const AppContext = createContext();

// AppProvider component
const AppProvider = ({ children }) => {
  const [theme, setThemeState] = useState('light');
  const [language, setLanguageState] = useState('pt');
  const [isLoading, setIsLoading] = useState(true);
  
  // Load theme and language on app start
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load theme
        const savedTheme = await getTheme();
        setThemeState(savedTheme);
        
        // Load language
        const savedLanguage = await getLanguage();
        setLanguageState(savedLanguage);
        
        // Initialize sound service
        await initSoundService();
      } catch (error) {
        console.error('Failed to load app settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, []);
  
  // Change theme
  const changeTheme = async (newTheme) => {
    setThemeState(newTheme);
    await setTheme(newTheme);
  };
  
  // Change language
  const changeLanguage = async (newLanguage) => {
    setLanguageState(newLanguage);
    await setLanguage(newLanguage);
  };
  
  // Get current styles based on theme
  const styles = createStyles(themes[theme]);
  
  // Get translations based on language
  const t = (key) => {
    const keys = key.split('.');
    let translation = translations[language];
    
    for (const k of keys) {
      translation = translation?.[k];
      
      if (translation === undefined) {
        // Fallback to English
        let fallback = translations['en'];
        for (const fk of keys) {
          fallback = fallback?.[fk];
          if (fallback === undefined) {
            return key; // Return the key if translation is not found
          }
        }
        translation = fallback;
      }
    }
    
    return translation;
  };
  
  // Context value
  const contextValue = {
    theme,
    themeName: theme,
    themeColors: themes[theme],
    styles,
    language,
    t,
    changeTheme,
    changeLanguage,
    isLoading
  };
  
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: themes[theme].backgroundColor }}>
        <ActivityIndicator size="large" color={themes[theme].primary} />
      </View>
    );
  }
  
  return (
    <AppContext.Provider value={contextValue}>
      <StatusBar 
        barStyle={themes[theme].statusBar === 'dark' ? 'dark-content' : 'light-content'} 
        backgroundColor={themes[theme].backgroundColor}
      />
      {children}
    </AppContext.Provider>
  );
};

// Custom hook to use the AppContext
const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// ==================== HOME SCREEN ====================
const HomeScreen = () => {
  const navigation = useNavigation();
  const { styles, t, themeColors } = useApp();
  const [challengeCount, setChallengeCount] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  useEffect(() => {
    // Load stats when screen is focused
    const loadStats = async () => {
      try {
        const history = await getHistory();
        setChallengeCount(history.length);
        
        // Find best score
        if (history.length > 0) {
          const best = Math.max(...history.map(h => h.score));
          setBestScore(best);
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    };
    
    loadStats();
    
    // Add focus listener for navigation
    const unsubscribe = navigation.addListener('focus', loadStats);
    return unsubscribe;
  }, [navigation]);

  const startChallenge = () => {
    navigation.navigate('Challenge');
  };

  const viewHistory = () => {
    navigation.navigate('History');
  };

  const openSettings = () => {
    navigation.navigate('Settings');
  };

  const checkSensors = async () => {
    // Get sensor status
    const sensorStatus = getSensorStatus();
    
    // If any sensors are unavailable, show an alert
    if (!sensorStatus.accelerometer || !sensorStatus.gyroscope || !sensorStatus.magnetometer) {
      Alert.alert(
        t('sensorWarning'),
        `${t('sensorsMissing')}:\n${!sensorStatus.accelerometer ? '- ' + t('accelerometer') + '\n' : ''}${!sensorStatus.gyroscope ? '- ' + t('gyroscope') + '\n' : ''}${!sensorStatus.magnetometer ? '- ' + t('magnetometer') : ''}`,
        [{ text: "OK" }]
      );
    }
  };

  useEffect(() => {
    // Call checkSensors once on mount
    checkSensors();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={styles.titleText}>{t('appName')}</Text>
        <Text style={styles.subtitle}>{t('appSubtitle')}</Text>
      </View>
      
      <View style={{ alignItems: 'center', marginVertical: 20 }}>
        <Image 
          source={{ uri: 'https://images.unsplash.com/photo-1620213391117-0d169a917221' }} 
          style={{ width: '90%', height: 180, borderRadius: 10 }}
          resizeMode="cover"
        />
      </View>
      
      <View style={styles.statContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{challengeCount}</Text>
          <Text style={styles.statLabel}>{t('totalChallenges')}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{bestScore}</Text>
          <Text style={styles.statLabel}>{t('bestScore')}</Text>
        </View>
      </View>
      
      <View style={{ padding: 20 }}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={startChallenge}
        >
          <Ionicons name="play" size={24} color="white" />
          <Text style={styles.buttonText}>{t('startChallenge')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={viewHistory}
        >
          <Ionicons name="time" size={24} color={themeColors.primary} />
          <Text style={styles.secondaryButtonText}>{t('history')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={openSettings}
        >
          <Ionicons name="settings" size={24} color={themeColors.primary} />
          <Text style={styles.secondaryButtonText}>{t('settings')}</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('aboutTitle')}</Text>
        <Text style={styles.text}>
          {t('aboutDescription')}
        </Text>
        
        <Text style={styles.sectionTitle}>{t('sensorsTitle')}</Text>
        <View style={{ marginTop: 10 }}>
          <View style={styles.sensorItem}>
            <Ionicons name="speedometer" size={24} color={themeColors.primary} />
            <Text style={styles.sensorText}>{t('accelerometerDesc')}</Text>
          </View>
          <View style={styles.sensorItem}>
            <Ionicons name="sync" size={24} color={themeColors.primary} />
            <Text style={styles.sensorText}>{t('gyroscopeDesc')}</Text>
          </View>
          <View style={styles.sensorItem}>
            <Ionicons name="compass" size={24} color={themeColors.primary} />
            <Text style={styles.sensorText}>{t('magnetometerDesc')}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

// ==================== CHALLENGE SCREEN ====================
const ChallengeScreen = () => {
  const navigation = useNavigation();
  const { styles, t, themeColors } = useApp();
  const [challenge, setChallenge] = useState(null);
  const [isPaused, setIsPaused] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [sensorData, setSensorData] = useState({
    accelerometer: { x: 0, y: 0, z: 0 },
    gyroscope: { x: 0, y: 0, z: 0 },
    magnetometer: { x: 0, y: 0, z: 0 }
  });
  const [sessionChallenges, setSessionChallenges] = useState([]);
  
  // References
  const timerRef = useRef(null);
  const challengeTimeout = useRef(null);
  
  // Reset everything when the screen first loads
  useEffect(() => {
    // Set up navigation listeners
    const unsubscribeBlur = navigation.addListener('blur', () => {
      pauseChallenge();
      stopSensors();
    });
    
    const unsubscribeFocus = navigation.addListener('focus', () => {
      // Don't automatically restart sensors if coming back from another screen
      if (sessionChallenges.length === 0) {
        startNewSession();
      }
    });
    
    return () => {
      // Clean up everything on unmount
      stopSensors();
      clearTimeout(timerRef.current);
      clearTimeout(challengeTimeout.current);
      unsubscribeBlur();
      unsubscribeFocus();
    };
  }, [navigation]);
  
  // Start new challenge session
  const startNewSession = () => {
    setScore(0);
    setSessionChallenges([]);
    generateNewChallenge();
  };
  
  // Watch for completed challenges
  useEffect(() => {
    if (!isPaused && challenge) {
      const checkCompletionInterval = setInterval(() => {
        const sensorState = getSensorData();
        setSensorData(sensorState);
        
        // Verify completion
        const result = verifyChallengeCompletion(challenge, sensorState);
        
        if (result.completed) {
          // Challenge completed
          const points = Math.round(result.performance * 100);
          challengeCompleted(points);
          clearInterval(checkCompletionInterval);
        }
      }, 100);
      
      return () => {
        clearInterval(checkCompletionInterval);
      };
    }
  }, [isPaused, challenge]);
  
  // Start sensor services
  const startSensors = async () => {
    try {
      // Start sensors and get initial readings
      await startSensorServices((data) => {
        setSensorData(data);
      });
      
      // Play sound to indicate start
      playSound(SOUND_TYPES.CHALLENGE_START);
      
    } catch (error) {
      console.error('Failed to start sensors:', error);
      Alert.alert('Error', 'Failed to access device sensors');
    }
  };
  
  // Stop sensor services
  const stopSensors = async () => {
    stopSensorServices();
  };
  
  // Generate a new challenge
  const generateNewChallenge = () => {
    resetChallengeTracking();
    const newChallenge = generateChallenge();
    setChallenge(newChallenge);
    
    // Set time limit based on challenge type
    let timeLimit = 15; // Default
    
    if (newChallenge.type === CHALLENGE_TYPES.RUN) {
      timeLimit = 10;
    } else if (newChallenge.type === CHALLENGE_TYPES.ROTATE) {
      timeLimit = 8;
    } else if (newChallenge.type === CHALLENGE_TYPES.TILT) {
      timeLimit = 6;
    } else if (newChallenge.type === CHALLENGE_TYPES.DIRECTION) {
      timeLimit = 8;
    }
    
    setTimeLeft(timeLimit);
    
    // Initially set to paused state
    setIsPaused(true);
  };
  
  // Start challenge timer
  const startChallenge = async () => {
    // Start sensors
    await startSensors();
    
    setIsPaused(false);
    
    // Start the timer
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up - challenge failed
          clearInterval(timerRef.current);
          challengeFailed();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  // Pause challenge
  const pauseChallenge = () => {
    setIsPaused(true);
    clearInterval(timerRef.current);
  };
  
  // Handle challenge completion
  const challengeCompleted = (points) => {
    // Stop timer
    clearInterval(timerRef.current);
    setIsPaused(true);
    
    // Play success sound
    playSound(SOUND_TYPES.CHALLENGE_COMPLETE);
    
    // Add to session score
    setScore((prevScore) => prevScore + points);
    
    // Add to session challenges
    setSessionChallenges((prev) => [
      ...prev,
      { 
        ...challenge, 
        completed: true, 
        score: points,
        timeLeft
      }
    ]);
    
    // Clear challenge after delay
    challengeTimeout.current = setTimeout(() => {
      // Generate next challenge
      generateNewChallenge();
    }, 2000);
  };
  
  // Handle challenge failure
  const challengeFailed = () => {
    // Play failure sound
    playSound(SOUND_TYPES.CHALLENGE_FAIL);
    
    // Add to session challenges
    setSessionChallenges((prev) => [
      ...prev,
      { 
        ...challenge, 
        completed: false, 
        score: 0,
        timeLeft: 0
      }
    ]);
    
    // Clear challenge after delay
    challengeTimeout.current = setTimeout(() => {
      // Generate next challenge or end session
      generateNewChallenge();
    }, 2000);
  };
  
  // Skip current challenge
  const skipChallenge = () => {
    // Stop timer
    clearInterval(timerRef.current);
    
    // Add to session challenges (as skipped)
    setSessionChallenges((prev) => [
      ...prev,
      { 
        ...challenge, 
        completed: false, 
        score: 0,
        timeLeft,
        skipped: true
      }
    ]);
    
    // Generate next challenge
    generateNewChallenge();
  };
  
  // End session and save results
  const endSession = async () => {
    // Stop everything
    clearInterval(timerRef.current);
    clearTimeout(challengeTimeout.current);
    setIsPaused(true);
    stopSensors();
    
    // Save session if challenges were completed
    if (sessionChallenges.length > 0) {
      try {
        const sessionData = {
          date: new Date().toISOString(),
          score,
          challenges: sessionChallenges,
          totalChallenges: sessionChallenges.length
        };
        
        await saveChallenge(sessionData);
        
        // Navigate to results
        navigation.navigate('Result', { 
          score, 
          challenges: sessionChallenges 
        });
      } catch (error) {
        console.error('Failed to save session:', error);
        Alert.alert('Error', 'Failed to save session results');
      }
    } else {
      // Just return to home
      navigation.navigate('Home');
    }
  };
  
  // Check if user really wants to end the session
  const confirmEndSession = () => {
    if (sessionChallenges.length > 0) {
      Alert.alert(
        t('endSessionTitle'),
        t('endSessionMessage'),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('end'), onPress: endSession }
        ]
      );
    } else {
      // No challenges completed, just go back
      navigation.goBack();
    }
  };
  
  // Render the sensor display component
  const renderSensorDisplay = () => {
    if (!sensorData) return null;
    
    const { accelerometer, gyroscope, magnetometer } = sensorData;
    
    // Determine which sensors to display based on the active challenge
    const showAccelerometer = !challenge || ['RUN'].includes(challenge.type);
    const showGyroscope = !challenge || ['ROTATE', 'TILT'].includes(challenge.type);
    const showMagnetometer = !challenge || ['DIRECTION'].includes(challenge.type);
    
    // Get sensor status
    const sensorStatus = getSensorStatus();
    
    // Format data for display
    const accMagnitude = Math.sqrt(
      Math.pow(accelerometer.x, 2) + 
      Math.pow(accelerometer.y, 2) + 
      Math.pow(accelerometer.z, 2)
    ).toFixed(2);
    
    const gyroX = gyroscope.x.toFixed(2);
    const gyroY = gyroscope.y.toFixed(2);
    const gyroZ = gyroscope.z.toFixed(2);
    
    const heading = Math.atan2(magnetometer.y, magnetometer.x) * (180 / Math.PI);
    const normalizedHeading = (heading < 0 ? heading + 360 : heading).toFixed(0);
    
    // Get direction name
    const getDirectionName = (heading) => {
      const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
      return directions[Math.round(heading / 45) % 8];
    };
    
    const direction = getDirectionName(normalizedHeading);
    
    return (
      <View style={{ marginTop: 20, paddingHorizontal: 20 }}>
        {showAccelerometer && (
          <View style={[
            styles.infoBox,
            challenge && challenge.type === 'RUN' && { borderLeftWidth: 4, borderLeftColor: themeColors.primary }
          ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name="speedometer" 
                size={18} 
                color={sensorStatus.accelerometer ? themeColors.primary : "#aaa"} 
              />
              <Text style={[
                styles.infoTitle,
                !sensorStatus.accelerometer && { color: "#aaa" }
              ]}>
                {t('accelerometer')}
              </Text>
            </View>
            {sensorStatus.accelerometer ? (
              <Text style={styles.infoText}>
                {t('movement')}: {accMagnitude}
              </Text>
            ) : (
              <Text style={[styles.infoText, { fontStyle: 'italic' }]}>
                {t('sensorUnavailable')}
              </Text>
            )}
          </View>
        )}
        
        {showGyroscope && (
          <View style={[
            styles.infoBox,
            challenge && 
            (challenge.type === 'ROTATE' || challenge.type === 'TILT') && 
            { borderLeftWidth: 4, borderLeftColor: themeColors.primary },
            { marginTop: 10 }
          ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name="sync" 
                size={18} 
                color={sensorStatus.gyroscope ? themeColors.primary : "#aaa"} 
              />
              <Text style={[
                styles.infoTitle,
                !sensorStatus.gyroscope && { color: "#aaa" }
              ]}>
                {t('gyroscope')}
              </Text>
            </View>
            {sensorStatus.gyroscope ? (
              <Text style={styles.infoText}>
                {t('rotation')}: X:{gyroX} Y:{gyroY} Z:{gyroZ}
              </Text>
            ) : (
              <Text style={[styles.infoText, { fontStyle: 'italic' }]}>
                {t('sensorUnavailable')}
              </Text>
            )}
          </View>
        )}
        
        {showMagnetometer && (
          <View style={[
            styles.infoBox,
            challenge && challenge.type === 'DIRECTION' && { borderLeftWidth: 4, borderLeftColor: themeColors.primary },
            { marginTop: 10 }
          ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name="compass" 
                size={18} 
                color={sensorStatus.magnetometer ? themeColors.primary : "#aaa"} 
              />
              <Text style={[
                styles.infoTitle,
                !sensorStatus.magnetometer && { color: "#aaa" }
              ]}>
                {t('compass')}
              </Text>
            </View>
            {sensorStatus.magnetometer ? (
              <Text style={styles.infoText}>
                {t('heading')}: {normalizedHeading}° {direction}
              </Text>
            ) : (
              <Text style={[styles.infoText, { fontStyle: 'italic' }]}>
                {t('sensorUnavailable')}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: themeColors.secondaryTextColor }}>{t('score')}</Text>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: themeColors.primary }}>{score}</Text>
        </View>
        
        <View style={styles.timerContainer}>
          <Ionicons name="timer-outline" size={18} color={themeColors.primary} />
          <Text style={styles.timer}>{timeLeft}</Text>
        </View>
        
        <TouchableOpacity 
          style={{ padding: 5 }}
          onPress={confirmEndSession}
        >
          <Ionicons name="close" size={24} color={themeColors.secondaryTextColor} />
        </TouchableOpacity>
      </View>
      
      <View style={{ padding: 20 }}>
        {challenge && (
          <View style={[
            styles.challengeCard,
            { backgroundColor: challenge.type === 'RUN' ? '#4e73df' : 
                             challenge.type === 'ROTATE' ? '#1cc88a' : 
                             challenge.type === 'TILT' ? '#f6c23e' : 
                             challenge.type === 'DIRECTION' ? '#e74a3b' : '#4e73df' }
          ]}>
            <View style={{ 
              width: 80, 
              height: 80, 
              borderRadius: 40, 
              backgroundColor: 'rgba(255,255,255,0.2)', 
              justifyContent: 'center', 
              alignItems: 'center', 
              marginBottom: 15 
            }}>
              <Ionicons 
                name={challenge.type === 'RUN' ? 'walk' : 
                      challenge.type === 'ROTATE' ? 'sync' : 
                      challenge.type === 'TILT' ? 'phone-portrait' : 
                      challenge.type === 'DIRECTION' ? 'compass' : 'help-circle'} 
                size={40} 
                color="white" 
              />
            </View>
            <Text style={styles.challengeText}>{challenge.instruction}</Text>
            {challenge.hint && (
              <Text style={styles.challengeHint}>{challenge.hint}</Text>
            )}
          </View>
        )}
      </View>
      
      <View style={{ flexDirection: 'row', paddingHorizontal: 20 }}>
        {isPaused ? (
          <TouchableOpacity 
            style={[styles.button, { flex: 1, marginRight: 10 }]} 
            onPress={startChallenge}
          >
            <Ionicons name="play" size={24} color="white" />
            <Text style={styles.buttonText}>{t('challengeStart')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.secondaryButton, { flex: 1, marginRight: 10 }]} 
            onPress={pauseChallenge}
          >
            <Ionicons name="pause" size={24} color={themeColors.primary} />
            <Text style={styles.secondaryButtonText}>{t('challengePause')}</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.secondaryButton, { paddingHorizontal: 15 }]} 
          onPress={skipChallenge}
        >
          <Ionicons name="arrow-forward" size={24} color={themeColors.secondaryTextColor} />
          <Text style={[styles.secondaryButtonText, { color: themeColors.secondaryTextColor }]}>{t('challengeSkip')}</Text>
        </TouchableOpacity>
      </View>
      
      {renderSensorDisplay()}
    </View>
  );
};

// ==================== RESULT SCREEN ====================
const ResultScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { styles, t, themeColors } = useApp();
  const { score = 0, challenges = [] } = route.params || {};
  
  // Calculate stats
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    accuracy: 0
  });
  
  useEffect(() => {
    const total = challenges.length;
    const completed = challenges.filter(c => c.completed).length;
    const failed = challenges.filter(c => !c.completed && !c.skipped).length;
    const skipped = challenges.filter(c => c.skipped).length;
    const accuracy = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    setStats({
      total,
      completed,
      failed,
      skipped,
      accuracy
    });
  }, [challenges]);
  
  // Determine performance message based on score and accuracy
  const getPerformanceMessage = () => {
    if (stats.accuracy >= 80) {
      return t('excellentPerformance');
    } else if (stats.accuracy >= 60) {
      return t('goodPerformance');
    } else if (stats.accuracy >= 40) {
      return t('decentPerformance');
    } else {
      return t('needsPractice');
    }
  };
  
  // Navigation handlers
  const goHome = () => {
    navigation.navigate('Home');
  };
  
  const startNewChallenge = () => {
    navigation.navigate('Challenge');
  };
  
  // Render a result item row
  const ResultItemRow = ({ challenge }) => {
    // Get icon based on challenge type
    const getIcon = () => {
      switch (challenge.type) {
        case 'RUN':
          return 'walk';
        case 'ROTATE':
          return 'sync';
        case 'TILT':
          return 'phone-portrait';
        case 'DIRECTION':
          return 'compass';
        default:
          return 'help-circle';
      }
    };
    
    // Get status icon based on completion
    const getStatusIcon = () => {
      if (challenge.skipped) {
        return { name: 'arrow-forward-circle', color: '#858796' };
      } else if (challenge.completed) {
        return { name: 'checkmark-circle', color: '#1cc88a' };
      } else {
        return { name: 'close-circle', color: '#e74a3b' };
      }
    };
    
    const statusIcon = getStatusIcon();
    
    return (
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: themeColors.border
      }}>
        <View style={{ 
          width: 36, 
          height: 36, 
          borderRadius: 18, 
          backgroundColor: themeColors.cardBackground === '#FFFFFF' ? '#f1f5fe' : '#2A2A2A',  
          justifyContent: 'center', 
          alignItems: 'center', 
          marginRight: 12 
        }}>
          <Ionicons name={getIcon()} size={20} color={themeColors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: themeColors.textColor }}>{challenge.instruction}</Text>
          {challenge.skipped ? (
            <Text style={{ fontSize: 12, color: '#858796' }}>{t('skipped')}</Text>
          ) : challenge.completed ? (
            <Text style={{ fontSize: 12, color: '#1cc88a', fontWeight: 'bold' }}>+{challenge.score} pts</Text>
          ) : (
            <Text style={{ fontSize: 12, color: '#e74a3b' }}>{t('failed')}</Text>
          )}
        </View>
        <Ionicons name={statusIcon.name} size={24} color={statusIcon.color} />
      </View>
    );
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={{ 
        backgroundColor: themeColors.cardBackground, 
        paddingVertical: 20, 
        alignItems: 'center', 
        borderBottomWidth: 1, 
        borderBottomColor: themeColors.border 
      }}>
        <Text style={{ 
          fontSize: 24, 
          fontWeight: 'bold', 
          color: themeColors.primary, 
          marginBottom: 20 
        }}>{t('sessionComplete')}</Text>
        
        <View style={{ 
          alignItems: 'center', 
          backgroundColor: themeColors.cardBackground === '#FFFFFF' ? '#f1f5fe' : '#2A2A2A', 
          paddingVertical: 15, 
          paddingHorizontal: 30, 
          borderRadius: 10, 
          marginBottom: 15 
        }}>
          <Text style={{ 
            fontSize: 14, 
            color: themeColors.primary, 
            fontWeight: '500' 
          }}>{t('finalScore')}</Text>
          <Text style={{ 
            fontSize: 36, 
            fontWeight: 'bold', 
            color: themeColors.primary 
          }}>{score}</Text>
        </View>
        
        <Text style={{ 
          fontSize: 16, 
          fontStyle: 'italic', 
          color: themeColors.secondaryTextColor 
        }}>{getPerformanceMessage()}</Text>
      </View>
      
      <View style={{ backgroundColor: themeColors.cardBackground, padding: 15, marginTop: 15 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: themeColors.textColor }}>{stats.total}</Text>
            <Text style={{ fontSize: 12, color: themeColors.secondaryTextColor, marginTop: 5 }}>{t('totalChallenges')}</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: themeColors.textColor }}>{stats.accuracy}%</Text>
            <Text style={{ fontSize: 12, color: themeColors.secondaryTextColor, marginTop: 5 }}>{t('accuracy')}</Text>
          </View>
        </View>
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={16} color="#1cc88a" />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: themeColors.textColor, marginLeft: 5 }}>{stats.completed}</Text>
            </View>
            <Text style={{ fontSize: 12, color: themeColors.secondaryTextColor, marginTop: 5 }}>{t('completed')}</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="close-circle" size={16} color="#e74a3b" />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: themeColors.textColor, marginLeft: 5 }}>{stats.failed}</Text>
            </View>
            <Text style={{ fontSize: 12, color: themeColors.secondaryTextColor, marginTop: 5 }}>{t('failed')}</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="arrow-forward-circle" size={16} color="#858796" />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: themeColors.textColor, marginLeft: 5 }}>{stats.skipped}</Text>
            </View>
            <Text style={{ fontSize: 12, color: themeColors.secondaryTextColor, marginTop: 5 }}>{t('skipped')}</Text>
          </View>
        </View>
      </View>
      
      <View style={{ backgroundColor: themeColors.cardBackground, padding: 15, marginTop: 15, marginBottom: 15 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: themeColors.textColor, marginBottom: 15 }}>{t('challengeDetails')}</Text>
        
        {challenges.map((challenge, index) => (
          <ResultItemRow key={`result-${index}`} challenge={challenge} />
        ))}
      </View>
      
      <View style={{ paddingHorizontal: 20, paddingBottom: 30 }}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={startNewChallenge}
        >
          <Ionicons name="play" size={18} color="white" />
          <Text style={styles.buttonText}>{t('newChallenge')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={goHome}
        >
          <Ionicons name="home" size={18} color={themeColors.primary} />
          <Text style={styles.secondaryButtonText}>{t('backToHome')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ==================== HISTORY SCREEN ====================
const HistoryScreen = () => {
  const navigation = useNavigation();
  const { styles, t, themeColors } = useApp();
  const [history, setHistory] = useState([]);
  const [totalScore, setTotalScore] = useState(0);

  const loadHistory = async () => {
    try {
      const data = await getHistory();

      const sortedData = data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setHistory(sortedData);

      const total = data.reduce((sum, item) => sum + item.score, 0);
      setTotalScore(total);
    } catch (error) {
      console.error('Failed to load history:', error);
      Alert.alert('Error', 'Failed to load history data');
    }
  };
  
  useEffect(() => {
    
    loadHistory();
    
  
    const unsubscribe = navigation.addListener('focus', loadHistory);
    return unsubscribe;
  }, [navigation]);
  
  const handleClearHistory = () => {
    Alert.alert(
      t('clearHistory'),
      t('clearHistoryConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('clear'), 
          style: 'destructive',
          onPress: async () => {
            try {
              await clearHistory();
              setHistory([]);
              setTotalScore(0);
              Alert.alert('Success', 'History has been cleared');
            } catch (error) {
              console.error('Failed to clear history:', error);
              Alert.alert('Error', 'Failed to clear history');
            }
          }
        }
      ]
    );
  };
  
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Render a history item
  const HistoryItem = ({ item }) => {
    // Calculate completion rate
    const completedChallenges = item.challenges?.filter(c => c.score > 0).length || 0;
    const totalChallenges = item.totalChallenges || item.challenges?.length || 0;
    const completionRate = totalChallenges > 0 ? Math.round((completedChallenges / totalChallenges) * 100) : 0;
    
    // Determine badge color based on completion rate
    const getBadgeColor = () => {
      if (completionRate >= 80) return '#1cc88a'; // green
      if (completionRate >= 50) return '#f6c23e'; // yellow
      return '#e74a3b'; // red
    };
    
    return (
      <View style={{
        flexDirection: 'row',
        backgroundColor: themeColors.cardBackground,
        marginHorizontal: 15,
        marginTop: 10,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        overflow: 'hidden',
      }}>
        <View style={{
          width: 50,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: getBadgeColor(),
        }}>
          <Text style={{
            color: 'white',
            fontWeight: 'bold',
            fontSize: 16,
          }}>{completionRate}%</Text>
        </View>
        
        <View style={{ flex: 1, padding: 15 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 14, color: themeColors.secondaryTextColor }}>{formatDate(item.date)}</Text>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: themeColors.primary }}>{item.score} pts</Text>
          </View>
          
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}>
              <Ionicons name="checkmark-circle" size={14} color="#1cc88a" />
              <Text style={{ fontSize: 12, color: themeColors.secondaryTextColor, marginLeft: 4 }}>
                {completedChallenges} {t('completed')}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}>
              <Ionicons name="close-circle" size={14} color="#e74a3b" />
              <Text style={{ fontSize: 12, color: themeColors.secondaryTextColor, marginLeft: 4 }}>
                {totalChallenges - completedChallenges} {t('failed')}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };
  
  // Render empty state
  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="time" size={64} color={themeColors.border} />
      <Text style={styles.emptyTitle}>{t('noHistoryTitle')}</Text>
      <Text style={styles.emptyText}>{t('noHistoryMessage')}</Text>
      <TouchableOpacity 
        style={styles.button}
        onPress={() => navigation.navigate('Challenge')}
      >
        <Text style={styles.buttonText}>{t('startFirstChallenge')}</Text>
      </TouchableOpacity>
    </View>
  );
  
  return (
    <View style={styles.container}>
      {history.length > 0 && (
        <View style={styles.header}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: themeColors.secondaryTextColor }}>{t('score')}</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: themeColors.primary }}>{totalScore}</Text>
          </View>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}
            onPress={handleClearHistory}
          >
            <Ionicons name="trash-outline" size={18} color="#e74a3b" />
            <Text style={{ fontSize: 14, color: "#e74a3b", marginLeft: 5 }}>{t('clearHistory')}</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <FlatList
        data={history}
        renderItem={({ item }) => <HistoryItem item={item} />}
        keyExtractor={(item, index) => `history-${index}-${item.date}`}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
        ListEmptyComponent={<EmptyState />}
      />
    </View>
  );
};

// ==================== SETTINGS SCREEN ====================
const SettingsScreen = () => {
  const navigation = useNavigation();
  const { styles, t, themeColors, themeName, language, changeTheme, changeLanguage } = useApp();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [difficulty, setDifficulty] = useState('medium');
  
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    try {
 
      const soundSetting = await AsyncStorage.getItem('soundEnabled');
      setSoundEnabled(soundSetting === null ? true : soundSetting === 'true');
      
gs
      const diffSettings = await getDifficultySettings();
      
      if (diffSettings.sensitivity <= 0.7) {
        setDifficulty('easy');
      } else if (diffSettings.sensitivity >= 1.3) {
        setDifficulty('hard');
      } else {
        setDifficulty('medium');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };
  
  const toggleSound = async (value) => {
    try {
      setSoundEnabled(value);
      await setSoundEnabledState(value);
      
      
      if (value) {
        playSound(SOUND_TYPES.UI_CLICK);
      }
    } catch (error) {
      console.error('Failed to save sound setting:', error);
      Alert.alert('Error', 'Failed to save sound setting');
    }
  };
  
  const handleThemeChange = async (newTheme) => {
    await changeTheme(newTheme);
  };
  
  const handleLanguageChange = async (newLanguage) => {
    await changeLanguage(newLanguage);
  };
  
  const changeDifficulty = async (value) => {
    setDifficulty(value);
    
   
    let sensitivity = 1.0;
    let timeMultiplier = 1.0;
    
    switch(value) {
      case 'easy':
        sensitivity = 0.7; 
        timeMultiplier = 1.3; 
        break;
      case 'medium':
        sensitivity = 1.0;
        timeMultiplier = 1.0;
        break;
      case 'hard':
        sensitivity = 1.3; 
        timeMultiplier = 0.7; 
        break;
    }
    
    try {
      await setDifficultySettings({ sensitivity, timeMultiplier });
      
     
      if (soundEnabled) {
        playSound(SOUND_TYPES.UI_CLICK);
      }
    } catch (error) {
      console.error('Failed to save difficulty setting:', error);
      Alert.alert('Error', 'Failed to save difficulty setting');
    }
  };
  
  const handleResetSettings = () => {
    Alert.alert(
      t('resetSettings'),
      t('resetConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('reset'), 
          style: 'destructive',
          onPress: async () => {
            try {
              await setSoundEnabledState(true);
              await setDifficultySettings({ sensitivity: 1.0, timeMultiplier: 1.0 });
              await setTheme('light');
              await setLanguage('pt');
              
            
              setSoundEnabled(true);
              setDifficulty('medium');
              

              loadSettings();
           
              Alert.alert('Success', 'Settings have been reset to defaults');
            } catch (error) {
              console.error('Failed to reset settings:', error);
              Alert.alert('Error', 'Failed to reset settings');
            }
          }
        }
      ]
    );
  };
  
  // Render a difficulty selector
  const DifficultySelector = () => {
    const levels = [
      { id: 'easy', label: t('easy') },
      { id: 'medium', label: t('medium') },
      { id: 'hard', label: t('hard') }
    ];
    
    return (
      <View style={{ flexDirection: 'row' }}>
        {levels.map((level) => (
          <TouchableOpacity
            key={level.id}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 15,
              borderWidth: 1,
              borderColor: difficulty === level.id ? themeColors.primary : themeColors.border,
              marginHorizontal: 3,
              backgroundColor: difficulty === level.id ? themeColors.primary : themeColors.cardBackground,
            }}
            onPress={() => changeDifficulty(level.id)}
          >
            <Text 
              style={{
                fontSize: 12,
                color: difficulty === level.id ? 'white' : themeColors.secondaryTextColor,
                fontWeight: difficulty === level.id ? 'bold' : 'normal',
              }}
            >
              {level.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={[styles.card, { marginTop: 20 }]}>
        <Text style={styles.sectionTitle}>{t('themeSettings')}</Text>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>{t('darkTheme')}</Text>
          <Switch
            value={themeName === 'dark'}
            onValueChange={(value) => handleThemeChange(value ? 'dark' : 'light')}
            trackColor={{ false: themeColors.border, true: themeColors.primary }}
            thumbColor={'white'}
          />
        </View>
        
        <Text style={styles.sectionTitle}>{t('language')}</Text>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>{t('language')}</Text>
          <View style={styles.languageSelector}>
            <TouchableOpacity
              style={[
                styles.languageOption,
                language === 'en' && styles.languageOptionActive
              ]}
              onPress={() => handleLanguageChange('en')}
            >
              <Text 
                style={[
                  styles.languageText,
                  language === 'en' && styles.languageTextActive
                ]}
              >
                {t('english')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.languageOption,
                language === 'pt' && styles.languageOptionActive
              ]}
              onPress={() => handleLanguageChange('pt')}
            >
              <Text 
                style={[
                  styles.languageText,
                  language === 'pt' && styles.languageTextActive
                ]}
              >
                {t('portuguese')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('difficultyLevel')}</Text>
        
        <View style={styles.settingItem}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="body" size={24} color={themeColors.primary} />
            <Text style={[styles.settingLabel, { marginLeft: 10 }]}>{t('difficultyLevel')}</Text>
          </View>
          <DifficultySelector />
        </View>
        
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>{t('difficultyInfo')}</Text>
          <View style={{ flexDirection: 'row', marginBottom: 5 }}>
            <Text style={{ color: themeColors.primary, marginRight: 5 }}>•</Text>
            <Text style={styles.infoText}>
              <Text style={{ fontWeight: 'bold' }}>{t('easy')}:</Text> {t('easyDesc')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 5 }}>
            <Text style={{ color: themeColors.primary, marginRight: 5 }}>•</Text>
            <Text style={styles.infoText}>
              <Text style={{ fontWeight: 'bold' }}>{t('medium')}:</Text> {t('mediumDesc')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 5 }}>
            <Text style={{ color: themeColors.primary, marginRight: 5 }}>•</Text>
            <Text style={styles.infoText}>
              <Text style={{ fontWeight: 'bold' }}>{t('hard')}:</Text> {t('hardDesc')}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('soundSettings')}</Text>
        
        <View style={styles.settingItem}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="volume-high" size={24} color={themeColors.primary} />
            <Text style={[styles.settingLabel, { marginLeft: 10 }]}>{t('soundEffects')}</Text>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={toggleSound}
            trackColor={{ false: themeColors.border, true: themeColors.primary }}
            thumbColor={'white'}
          />
        </View>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('aboutSensors')}</Text>
        
        <View style={styles.infoBox}>
          <View style={{ flexDirection: 'row', marginBottom: 15 }}>
            <Ionicons name="speedometer" size={24} color={themeColors.primary} />
            <View style={{ marginLeft: 15, flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: themeColors.primary, marginBottom: 5 }}>
                {t('accelerometer')}
              </Text>
              <Text style={{ fontSize: 14, color: themeColors.secondaryTextColor }}>
                {t('accelerometerInfo')}
              </Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', marginBottom: 15 }}>
            <Ionicons name="sync" size={24} color={themeColors.primary} />
            <View style={{ marginLeft: 15, flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: themeColors.primary, marginBottom: 5 }}>
                {t('gyroscope')}
              </Text>
              <Text style={{ fontSize: 14, color: themeColors.secondaryTextColor }}>
                {t('gyroscopeInfo')}
              </Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', marginBottom: 15 }}>
            <Ionicons name="compass" size={24} color={themeColors.primary} />
            <View style={{ marginLeft: 15, flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: themeColors.primary, marginBottom: 5 }}>
                {t('magnetometer')}
              </Text>
              <Text style={{ fontSize: 14, color: themeColors.secondaryTextColor }}>
                {t('magnetometerInfo')}
              </Text>
            </View>
          </View>
        </View>
        
        <Text style={{ 
          fontSize: 12, 
          color: themeColors.secondaryTextColor, 
          fontStyle: 'italic', 
          marginTop: 15 
        }}>
          {t('sensorNote')}
        </Text>
      </View>
      
      <View style={{ alignItems: 'center', padding: 20 }}>
        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}
          onPress={handleResetSettings}
        >
          <Ionicons name="refresh" size={16} color="#e74a3b" />
          <Text style={{ fontSize: 14, color: "#e74a3b", marginLeft: 5 }}>{t('resetSettings')}</Text>
        </TouchableOpacity>
      </View>
      
      <View style={{ alignItems: 'center', marginBottom: 30 }}>
        <Text style={{ fontSize: 12, color: themeColors.secondaryTextColor }}>
          {t('appName')} v1.0.0
        </Text>
      </View>
    </ScrollView>
  );
};


const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{ 
              headerShown: false
            }} 
          />
          <Stack.Screen 
            name="Challenge" 
            component={ChallengeScreen} 
            options={{ 
              headerShown: false
            }} 
          />
          <Stack.Screen 
            name="Result" 
            component={ResultScreen} 
            options={{ 
              headerShown: false,
              gestureEnabled: false 
            }} 
          />
          <Stack.Screen 
            name="History" 
            component={HistoryScreen} 
            options={({ navigation, route }) => {
              const { themeColors, t } = useApp();
              return {
                title: t('history'),
                headerStyle: {
                  backgroundColor: themeColors.cardBackground,
                },
                headerTintColor: themeColors.textColor,
                headerTitleStyle: {
                  fontWeight: 'bold',
                  color: themeColors.textColor,
                },
                headerShadowVisible: false,
              };
            }}
          />
          <Stack.Screen 
            name="Settings" 
            component={SettingsScreen} 
            options={({ navigation, route }) => {
              const { themeColors, t } = useApp();
              return {
                title: t('settings'),
                headerStyle: {
                  backgroundColor: themeColors.cardBackground,
                },
                headerTintColor: themeColors.textColor,
                headerTitleStyle: {
                  fontWeight: 'bold',
                  color: themeColors.textColor,
                },
                headerShadowVisible: false,
              };
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}