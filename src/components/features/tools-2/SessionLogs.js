import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

// Регистрируем шрифт Roboto для поддержки кириллицы
Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf'
});

const fmtTime = (sec) => {
  if (sec == null) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Roboto', fontSize: 9, color: '#333' },
  header: { marginBottom: 12, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: '#0056b3', paddingBottom: 6 },
  title: { fontSize: 14, fontWeight: 'bold', color: '#0056b3', marginBottom: 3 },
  subTitle: { fontSize: 10, color: '#666' },
  section: { marginTop: 10, marginBottom: 6 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', backgroundColor: '#f0f4f8', padding: 4, marginBottom: 6, color: '#0056b3' },
  table: { display: 'table', width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#bfbfbf' },
  tableRow: { flexDirection: 'row' },
  tableColHeader: { borderStyle: 'solid', borderWidth: 1, borderColor: '#bfbfbf', backgroundColor: '#e6e6e6', padding: 4 },
  tableCol: { borderStyle: 'solid', borderWidth: 1, borderColor: '#bfbfbf', padding: 4 },
  tableCellHeader: { fontWeight: 'bold', fontSize: 8 },
  taskCard: { marginBottom: 8, padding: 8, borderWidth: 1, borderStyle: 'solid', borderColor: '#ddd', borderRadius: 3 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: '#eee', paddingBottom: 3 },
  taskTitle: { fontWeight: 'bold', fontSize: 10, color: '#0056b3' },
  taskMeta: { fontSize: 8, color: '#666' },
  contentBox: { marginBottom: 4, padding: 4, backgroundColor: '#fdfdfd', borderWidth: 1, borderStyle: 'solid', borderColor: '#f0f0f0' },
  contentLabel: { fontWeight: 'bold', fontSize: 8, color: '#555', marginBottom: 2 },
  contentText: { fontSize: 9, lineHeight: 1.3, color: '#333' },
  mayakSection: { marginTop: 4 },
  mayakRow: { flexDirection: 'row', marginBottom: 2, borderBottomWidth: 0.5, borderBottomStyle: 'solid', borderBottomColor: '#f0f0f0', paddingBottom: 1 },
  mayakLabel: { width: '90pt', fontWeight: 'bold', color: '#555', fontSize: 8 },
  mayakValue: { flex: 1, fontSize: 9, color: '#222' },
  finalPromptBox: { marginTop: 6, padding: 6, backgroundColor: '#f0f7ff', borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: '#0056b3' }
});

const isIntroTask = (number) => {
  const num = parseInt(number, 10);
  if (isNaN(num)) return false;
  return (num - 1) % 100 < 3;
};

const SessionLogs = ({ userName, userRole, date, totalTime, rankingData, tasks }) => {
  const filteredTasks = tasks ? tasks.filter(t => !isIntroTask(t.number)) : [];

  return (
  <Document title={`Лог_${userName}_${date}`}>
    <Page size="A4" style={styles.page}>
      {/* Шапка */}
      <View style={styles.header}>
        <Text style={styles.title}>Протокол прохождения тренажера МАЯК</Text>
        <Text style={styles.subTitle}>Участник: {userName} {userRole ? `| Роль: ${userRole}` : ''}</Text>
        <Text style={styles.subTitle}>Дата завершения: {date} | Общее время сессии: {totalTime}</Text>
      </View>

      {/* Блок ранжирования */}
      {rankingData && rankingData.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Результаты тестирования МАЯК-ОКО (Ранжирование)</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={[styles.tableColHeader, { width: '20%' }]}><Text style={styles.tableCellHeader}>Уровень</Text></View>
              <View style={[styles.tableColHeader, { width: '27%' }]}><Text style={styles.tableCellHeader}>Вход</Text></View>
              <View style={[styles.tableColHeader, { width: '27%' }]}><Text style={styles.tableCellHeader}>Выход</Text></View>
              <View style={[styles.tableColHeader, { width: '26%' }]}><Text style={styles.tableCellHeader}>Разница</Text></View>
            </View>
            {rankingData.map((row, i) => {
              let diffText = '—';
              if (row.in !== null && row.out !== null) {
                const diff = row.in - row.out;
                if (diff > 0) diffText = `-${diff} (лучше)`;
                else if (diff < 0) diffText = `+${Math.abs(diff)} (хуже)`;
                else diffText = '0';
              }
              return (
                <View style={styles.tableRow} key={i}>
                  <View style={[styles.tableCol, { width: '20%' }]}><Text>Уровень {i + 1}</Text></View>
                  <View style={[styles.tableCol, { width: '27%' }]}>
                    <Text>{row.in !== null ? `${row.in}` : '—'}{row.in !== null && row.inTime != null ? ` (${fmtTime(row.inTime)})` : ''}</Text>
                  </View>
                  <View style={[styles.tableCol, { width: '27%' }]}>
                    <Text>{row.out !== null ? `${row.out}` : '—'}{row.out !== null && row.outTime != null ? ` (${fmtTime(row.outTime)})` : ''}</Text>
                  </View>
                  <View style={[styles.tableCol, { width: '26%', color: row.color || '#333' }]}>
                    <Text>{diffText}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Детализация заданий */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Детализация по заданиям</Text>
        {filteredTasks.length > 0 ? filteredTasks.map((task, index) => (
          <View key={index} style={styles.taskCard}>
            {/* Заголовок задания */}
            <View style={styles.taskHeader}>
              <Text style={styles.taskTitle}>
                {task.title && (task.title.includes('Задание') || task.title.includes('№'))
                  ? task.title
                  : `Задание №${task.number}${task.title ? ` ${task.title}` : ''}`}
              </Text>
              <Text style={styles.taskMeta}>Время: {task.time}{task.avgTime ? ` | Среднее: ${fmtTime(task.avgTime)}` : ''}</Text>
            </View>

            {/* Название задания */}
            {task.taskTitle ? (
              <View style={styles.contentBox}>
                <Text style={styles.contentLabel}>Название задания:</Text>
                <Text style={styles.contentText}>{task.taskTitle}</Text>
              </View>
            ) : null}
            {/* Тип контента */}
            {task.contentType ? (
              <View style={styles.contentBox}>
                <Text style={styles.contentLabel}>Тип контента:</Text>
                <Text style={styles.contentText}>{task.contentType}</Text>
              </View>
            ) : null}

            {/* Описание и Задание */}
            {task.description && (
              <View style={styles.contentBox}>
                <Text style={styles.contentLabel}>Описание:</Text>
                <Text style={styles.contentText}>{task.description}</Text>
              </View>
            )}
            {task.taskText && (
              <View style={styles.contentBox}>
                <Text style={styles.contentLabel}>Задание:</Text>
                <Text style={styles.contentText}>{task.taskText}</Text>
              </View>
            )}

            {/* Поля МАЯК */}
            <View style={styles.mayakSection}>
              <Text style={[styles.contentLabel, { color: '#0056b3', paddingBottom: 1 }]}>МАЯК-ОКО:</Text>
              <View style={styles.mayakRow}>
                <Text style={styles.mayakLabel}>М (Миссия):</Text>
                <Text style={styles.mayakValue}>{task.mayak?.m || '—'}</Text>
              </View>
              <View style={styles.mayakRow}>
                <Text style={styles.mayakLabel}>А (Аудитория):</Text>
                <Text style={styles.mayakValue}>{task.mayak?.a || '—'}</Text>
              </View>
              <View style={styles.mayakRow}>
                <Text style={styles.mayakLabel}>Я (Роль):</Text>
                <Text style={styles.mayakValue}>{task.mayak?.y || '—'}</Text>
              </View>
              <View style={styles.mayakRow}>
                <Text style={styles.mayakLabel}>К (Критерии):</Text>
                <Text style={styles.mayakValue}>{task.mayak?.k || '—'}</Text>
              </View>
              <View style={styles.mayakRow}>
                <Text style={styles.mayakLabel}>О (Ограничения):</Text>
                <Text style={styles.mayakValue}>{task.mayak?.o1 || '—'}</Text>
              </View>
              <View style={styles.mayakRow}>
                <Text style={styles.mayakLabel}>К (Контекст):</Text>
                <Text style={styles.mayakValue}>{task.mayak?.k2 || '—'}</Text>
              </View>
              <View style={styles.mayakRow}>
                <Text style={styles.mayakLabel}>О (Оформление):</Text>
                <Text style={styles.mayakValue}>{task.mayak?.o2 || '—'}</Text>
              </View>
            </View>

            {/* Итоговый промпт */}
            <View style={styles.finalPromptBox}>
              <Text style={styles.contentLabel}>Итоговый промпт:</Text>
              <Text style={styles.contentText}>{task.finalPrompt || '—'}</Text>
            </View>
          </View>
        )) : (
          <Text style={{ textAlign: 'center', color: '#999', marginTop: 10 }}>Данные по заданиям отсутствуют</Text>
        )}
      </View>
    </Page>
  </Document>
  );
};

export default SessionLogs;
