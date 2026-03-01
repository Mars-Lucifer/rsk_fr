import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Регистрируем шрифт
Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf'
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    position: 'relative',
    padding: 0,
    margin: 0,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  },
  textWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 225, // Позиция имени
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  nameText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#000000',
  },
  dateWrapper: {
    position: 'absolute',
    top: 280, // Позиция даты (под именем)
    left: 0,
    right: 0,
    textAlign: 'center',
    width: '100%',
  },
  dateText: {
    fontSize: 20, // УВЕЛИЧИЛ ШРИФТ (было 14, стало 20)
    color: '#000000',
    fontWeight: 'bold', // Жирный шрифт для даты
  },
  qrWrapper: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    alignItems: 'center',
  },
  qrImage: {
    width: 80,
    height: 80,
  },
  qrLabel: {
    fontSize: 7,
    color: '#666666',
    marginTop: 2,
    textAlign: 'center',
  },
});

const Certificate = ({ userName, qrDataUrl }) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const imageSrc = `${origin}/certificat.png`;

  // --- ИСПРАВЛЕННАЯ ЛОГИКА ДАТЫ ---
  const getCurrentDateString = () => {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    
    // Получаем дату (например: "25 января 2026 г." или "25 января 2026")
    let dateStr = today.toLocaleDateString('ru-RU', options);
    
    // Удаляем "г." или " г." с конца строки, если они там есть, чтобы не дублировать
    dateStr = dateStr.replace(/ г\.?$/, '').trim();

    // Теперь сами добавляем концовку
    return `${dateStr} г. - 12 академических часов`;
  };

  const fullDateString = getCurrentDateString();

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Image 
          src={imageSrc} 
          style={styles.backgroundImage} 
          fixed 
        />

        <View style={styles.textWrapper}>
          <Text style={styles.nameText}>{userName}</Text>
        </View>

        <View style={styles.dateWrapper}>
           <Text style={styles.dateText}>{fullDateString}</Text>
        </View>

        {qrDataUrl && (
          <View style={styles.qrWrapper}>
            <Image src={qrDataUrl} style={styles.qrImage} />
            <Text style={styles.qrLabel}>Проверить сертификат</Text>
          </View>
        )}

      </Page>
    </Document>
  );
};

export default Certificate;