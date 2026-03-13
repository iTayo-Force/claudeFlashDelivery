import React, { useState, useCallback, useRef } from 'react';
import {
  View, TextInput, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../utils/theme';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface PlaceDetails {
  address: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  label?: string;
  placeholder?: string;
  value: string;
  onSelect: (details: PlaceDetails) => void;
  onChangeText?: (text: string) => void;
}

export function AddressAutocomplete({
  label,
  placeholder = 'Rechercher une adresse...',
  value,
  onSelect,
  onChangeText,
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchPlaces = useCallback((input: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!input || input.length < 3 || !GOOGLE_MAPS_API_KEY) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:cm&language=fr&key=${GOOGLE_MAPS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.predictions) {
          setPredictions(data.predictions);
          setShowDropdown(true);
        }
      } catch {
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const handleSelect = useCallback(async (prediction: Prediction) => {
    setShowDropdown(false);
    setPredictions([]);

    if (!GOOGLE_MAPS_API_KEY) {
      onSelect({
        address: prediction.description,
        lat: 0,
        lng: 0,
      });
      return;
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry,formatted_address&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.result) {
        onSelect({
          address: data.result.formatted_address || prediction.description,
          lat: data.result.geometry.location.lat,
          lng: data.result.geometry.location.lng,
        });
      }
    } catch {
      onSelect({
        address: prediction.description,
        lat: 0,
        lng: 0,
      });
    }
  }, [onSelect]);

  const handleChangeText = (text: string) => {
    onChangeText?.(text);
    searchPlaces(text);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.gray[400]}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        />
        {loading && <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />}
      </View>

      {showDropdown && predictions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)}>
                <Text style={styles.mainText}>{item.structured_formatting.main_text}</Text>
                <Text style={styles.secondaryText}>{item.structured_formatting.secondary_text}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md, zIndex: 10 },
  label: { fontSize: fontSize.sm, fontWeight: '500', color: colors.gray[700], marginBottom: spacing.xs },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, backgroundColor: colors.white },
  input: { flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text },
  loader: { paddingRight: spacing.md },
  dropdown: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderTopWidth: 0, borderBottomLeftRadius: borderRadius.md, borderBottomRightRadius: borderRadius.md, maxHeight: 200, elevation: 5, shadowColor: colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  item: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  mainText: { fontSize: fontSize.md, fontWeight: '500', color: colors.text },
  secondaryText: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
});
