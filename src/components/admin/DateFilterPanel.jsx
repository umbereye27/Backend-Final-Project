'use client';
import { useState } from 'react';
import { Card, DatePicker, Button, Space, Alert } from 'antd';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const { RangePicker } = DatePicker;

const DateFilterPanel = ({ onFilterApply, onGeneratePDF }) => {
  const [dateRange, setDateRange] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleDateChange = (dates) => {
    setDateRange(dates);
    setError(null);
  };

  const handleFilter = () => {
    if (!dateRange || !dateRange[0]) {
      setError('Please select a date range');
      return;
    }

    setLoading(true);
    const startDate = dateRange[0].format('YYYY-MM-DD');
    const endDate = dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : startDate;
    
    onFilterApply(startDate, endDate)
      .finally(() => setLoading(false));
  };

  const handleGeneratePDF = () => {
    if (!dateRange || !dateRange[0]) {
      setError('Please select a date range');
      return;
    }

    setLoading(true);
    const startDate = dateRange[0].format('YYYY-MM-DD');
    const endDate = dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : startDate;
    
    onGeneratePDF(startDate, endDate)
      .finally(() => setLoading(false));
  };

  return (
    <Card title="Filter Results by Date" className="mb-4">
      {error && <Alert message={error} type="error" className="mb-3" />}
      
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <RangePicker 
          onChange={handleDateChange}
          style={{ width: '100%' }}
          allowClear
        />
        
        <Space>
          <Button 
            type="primary" 
            icon={<SearchOutlined />} 
            onClick={handleFilter}
            loading={loading}
          >
            Apply Filter
          </Button>
          
          <Button 
            icon={<DownloadOutlined />} 
            onClick={handleGeneratePDF}
            loading={loading}
          >
            Download PDF Report
          </Button>
        </Space>
      </Space>
    </Card>
  );
};

export default DateFilterPanel;