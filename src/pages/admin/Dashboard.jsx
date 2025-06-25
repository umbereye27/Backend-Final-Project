'use client';
import { useState, useEffect } from 'react';
import { Row, Col, Table, Card, Spin, message } from 'antd';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import DateFilterPanel from '../../components/admin/DateFilterPanel';
import { fetchResultsByDateRange, fetchUserStats } from '../../services/api';

const AdminDashboard = () => {
  const [results, setResults] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [dateFilter, setDateFilter] = useState(null);

  useEffect(() => {
    fetchUserStatistics();
  }, []);

  useEffect(() => {
    if (dateFilter) {
      fetchFilteredResults(pagination.current, pagination.pageSize);
    }
  }, [pagination.current, pagination.pageSize, dateFilter]);

  const fetchUserStatistics = async () => {
    try {
      const data = await fetchUserStats();
      setUserStats(data.stats);
    } catch (error) {
      message.error('Failed to fetch user statistics');
      console.error(error);
    }
  };

  const fetchFilteredResults = async (page, pageSize) => {
    if (!dateFilter) return;
    
    setLoading(true);
    try {
      const { startDate, endDate } = dateFilter;
      const response = await fetchResultsByDateRange(startDate, endDate, page, pageSize);
      
      setResults(response.data);
      setPagination({
        ...pagination,
        current: page,
        total: response.pagination.totalResults
      });
    } catch (error) {
      if (error.response?.status === 404) {
        setResults([]);
        setPagination({
          ...pagination,
          total: 0
        });
        message.info('No results found for the selected date range');
      } else {
        message.error('Failed to fetch results');
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFilterApply = async (startDate, endDate) => {
    setDateFilter({ startDate, endDate });
    setPagination({
      ...pagination,
      current: 1
    });
    
    return fetchFilteredResults(1, pagination.pageSize);
  };

  const handleTableChange = (pagination) => {
    setPagination(pagination);
  };

  const generatePDF = async (startDate, endDate) => {
    setLoading(true);
    try {
      // Fetch all results for the PDF (without pagination)
      const response = await fetchResultsByDateRange(startDate, endDate, 1, 1000);
      
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(18);
      doc.text('Results Report', 14, 22);
      
      // Add date range
      doc.setFontSize(12);
      doc.text(`Date Range: ${startDate} to ${endDate}`, 14, 30);
      
      // Add timestamp
      const now = new Date();
      doc.text(`Generated: ${now.toLocaleString()}`, 14, 36);
      
      // Add user stats if available
      if (userStats) {
        doc.text('User Statistics:', 14, 46);
        doc.text(`Total Users: ${userStats.totalUsers}`, 20, 52);
        doc.text(`Admin Users: ${userStats.adminCount} (${userStats.adminPercentage}%)`, 20, 58);
        doc.text(`Regular Users: ${userStats.userCount} (${userStats.userPercentage}%)`, 20, 64);
      }
      
      // Add results table
      const tableColumn = ["Date", "Prediction", "Confidence", "User"];
      const tableRows = [];
      
      response.data.forEach(result => {
        const date = new Date(result.createdAt).toLocaleDateString();
        const userData = result.user ? result.user.username : 'Unknown';
        
        tableRows.push([
          date,
          result.prediction,
          `${result.confidence}%`,
          userData
        ]);
      });
      
      doc.autoTable({
        startY: userStats ? 70 : 46,
        head: [tableColumn],
        body: tableRows,
      });
      
      // Save the PDF
      doc.save(`results-report-${startDate}-to-${endDate}.pdf`);
      
      message.success('PDF report generated successfully');
    } catch (error) {
      message.error('Failed to generate PDF report');
      console.error(error);
    } finally {
      setLoading(false);
    }
    
    return Promise.resolve();
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: 'Prediction',
      dataIndex: 'prediction',
      key: 'prediction',
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence',
      key: 'confidence',
      render: (text) => `${text}%`,
    },
    {
      title: 'User',
      dataIndex: 'user',
      key: 'user',
      render: (user) => user ? user.username : 'Unknown',
    }
  ];

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={24}>
          <DateFilterPanel 
            onFilterApply={handleFilterApply}
            onGeneratePDF={generatePDF}
          />
        </Col>
        
        {userStats && (
          <Col xs={24} lg={24}>
            <Card title="User Statistics" className="mb-4">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <Card>
                    <h3>Total Users</h3>
                    <p className="stat-number">{userStats.totalUsers}</p>
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card>
                    <h3>Admin Users</h3>
                    <p className="stat-number">{userStats.adminCount} ({userStats.adminPercentage}%)</p>
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card>
                    <h3>Regular Users</h3>
                    <p className="stat-number">{userStats.userCount} ({userStats.userPercentage}%)</p>
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>
        )}
        
        <Col xs={24}>
          <Card title="Results" className="mb-4">
            <Spin spinning={loading}>
              <Table
                columns={columns}
                dataSource={results}
                rowKey="_id"
                pagination={{
                  ...pagination,
                  showSizeChanger: true,
                }}
                onChange={handleTableChange}
              />
            </Spin>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminDashboard;