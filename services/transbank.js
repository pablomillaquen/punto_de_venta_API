// MOCK Transbank POS Service
// In a real scenario, this would import Transbank from 'transbank-pos-sdk'

class TransbankService {
  constructor() {
    this.connected = false;
  }

  async connect() {
    console.log('TRANSBANK: Connecting to POS...');
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.connected = true;
    console.log('TRANSBANK: Connected');
    return true;
  }

  async sale(amount, ticketNumber) {
    if (!this.connected) {
      await this.connect();
    }

    console.log(`TRANSBANK: Starting sale for amt: ${amount}, ticket: ${ticketNumber}`);
    
    // Simulate interaction time (customer inserting card, pin, etc.)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Simulate Success Response
    const response = {
      success: true,
      responseCode: 0,
      authorizationCode: '123456',
      ticketNumber: ticketNumber,
      amount: amount,
      commerceCode: '597012345678',
      terminalId: '12345678',
      transactionDate: new Date()
    };
    
    console.log('TRANSBANK: Sale Successful', response);
    return response;
  }
}

module.exports = new TransbankService();
