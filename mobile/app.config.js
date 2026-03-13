export default ({ config }) => {
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    '';

  return {
    ...config,
    expo: {
      ...config.expo,
      ios: {
        ...config.expo?.ios,
        config: {
          googleMapsApiKey,
        },
      },
      android: {
        ...config.expo?.android,
        config: {
          googleMaps: {
            apiKey: googleMapsApiKey,
          },
        },
      },
    },
  };
};
