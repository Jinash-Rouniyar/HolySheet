import React, { useState, useEffect } from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';
import './DataVisualizer.css';


interface DataVisualizerProps {
  spreadsheetData: any;
  isOpen: boolean;
  onClose: () => void;
}

interface ChartConfig {
  type: 'line' | 'bar' | 'pie';
  data: any;
  options: any;
}

const DataVisualizer: React.FC<DataVisualizerProps> = ({ spreadsheetData, isOpen, onClose }) => {
  const [chartConfigs, setChartConfigs] = useState<ChartConfig[]>([]);

  useEffect(() => {
    if (spreadsheetData) {
      analyzeAndCreateCharts(spreadsheetData);
    }
  }, [spreadsheetData]);

  const analyzeAndCreateCharts = (data: any) => {
    const configs: ChartConfig[] = [];
    
    // Check if data has numeric columns for trends
    if (hasNumericColumns(data)) {
      configs.push(createLineChart(data));
      configs.push(createBarChart(data));
    }

    // Check if data has categorical columns for distribution
    if (hasCategoricalColumns(data)) {
      configs.push(createPieChart(data));
    }

    setChartConfigs(configs);
  };

  const hasNumericColumns = (data: any) => {
    // Implement logic to check for numeric columns
    return true; // Placeholder
  };

  const hasCategoricalColumns = (data: any) => {
    // Implement logic to check for categorical columns
    return true; // Placeholder
  };

  const createLineChart = (data: any): ChartConfig => {
    // Example line chart configuration
    return {
      type: 'line',
      data: {
        labels: ['January', 'February', 'March', 'April', 'May'],
        datasets: [{
          label: 'Sample Data',
          data: [12, 19, 3, 5, 2],
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Data Trends'
          }
        }
      }
    };
  };

  const createBarChart = (data: any): ChartConfig => {
    // Example bar chart configuration
    return {
      type: 'bar',
      data: {
        labels: ['Category 1', 'Category 2', 'Category 3', 'Category 4'],
        datasets: [{
          label: 'Sample Data',
          data: [65, 59, 80, 81],
          backgroundColor: [
            'rgba(255, 99, 132, 0.5)',
            'rgba(54, 162, 235, 0.5)',
            'rgba(255, 206, 86, 0.5)',
            'rgba(75, 192, 192, 0.5)',
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Data Distribution'
          }
        }
      }
    };
  };

  const createPieChart = (data: any): ChartConfig => {
    // Example pie chart configuration
    return {
      type: 'pie',
      data: {
        labels: ['Red', 'Blue', 'Yellow'],
        datasets: [{
          data: [300, 50, 100],
          backgroundColor: [
            'rgb(255, 99, 132)',
            'rgb(54, 162, 235)',
            'rgb(255, 205, 86)'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Category Distribution'
          }
        }
      }
    };
  };

  if (!isOpen) return null;

  return (
    <div className="visualizer-container">
      <div className="visualizer-header">
        <h3>Data Visualization</h3>
        <button onClick={onClose} className="close-button">×</button>
      </div>
      <div className="charts-container">
        {chartConfigs.map((config, index) => (
          <div key={index} className="chart-wrapper">
            {config.type === 'line' && <Line data={config.data} options={config.options} />}
            {config.type === 'bar' && <Bar data={config.data} options={config.options} />}
            {config.type === 'pie' && <Pie data={config.data} options={config.options} />}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DataVisualizer; 