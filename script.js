// Initialize PocketBase
const pb = new PocketBase('https://siga-2000.pockethost.io/');

class DynamicVotingSystem {
  constructor() {
    this.config = {};
    this.categories = [];
    this.nominees = [];
    this.currentUser = null;
    this.currentSession = null;
    this.selectedAmount = 0;
    this.selectedVotes = 0;
    this.currentNominee = null;
    this.voteRates = [];
  }

  async init() {
    try {
      await this.loadAppConfig();
      await this.loadCategories();
      await this.loadNominees();
      await this.buildInterface();
      await this.subscribeToRealTimeUpdates();
      this.setupEventListeners();
      console.log('Voting system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize voting system:', error);
      this.showError('Failed to load voting system. Please refresh the page.');
    }
  }

  async loadAppConfig() {
    try {
      const configs = await pb.collection('app_config').getFullList({
        filter: 'isActive = true'
      });

      configs.forEach(config => {
        let value = config.value;
        switch (config.type) {
          case 'boolean':
            value = value === 'true';
            break;
          case 'number':
            value = parseFloat(value);
            break;
          case 'json':
            try {
              value = JSON.parse(value);
            } catch (e) {
              console.warn(`Failed to parse JSON config: ${config.key}`);
            }
            break;
        }
        this.config[config.key] = value;
      });

      this.voteRates = this.config.vote_conversion_rates || [
        { amount: 1, votes: 1 },
        { amount: 5, votes: 5 },
        { amount: 10, votes: 10 }
      ];

      console.log('App config loaded:', this.config);
    } catch (error) {
      console.error('Error loading app config:', error);
      throw error;
    }
  }

  async loadCategories() {
    try {
      this.categories = await pb.collection('categories').getFullList({
        filter: 'isActive = true',
        sort: 'displayOrder'
      });
      console.log('Categories loaded:', this.categories.length);
    } catch (error) {
      console.error('Error loading categories:', error);
      throw error;
    }
  }

  async loadNominees() {
    try {
      this.nominees = await pb.collection('nominees').getFullList({
        filter: 'isActive = true',
        sort: 'categoryId, displayOrder',
        expand: 'categoryId'
      });
      console.log('Nominees loaded:', this.nominees.length);
    } catch (error) {
      console.error('Error loading nominees:', error);
      throw error;
    }
  }

  async buildInterface() {
    this.updatePageTitle();
    this.buildVoteAmountSelector();
    this.buildCategoriesAndNominees();
  }

  updatePageTitle() {
    const title = this.config.app_title || 'Voting System';
    const subtitle = this.config.app_subtitle || 'Cast your votes';

    const loginHeader = document.querySelector('#login h1');
    if (loginHeader) loginHeader.textContent = title;

    const votingHeader = document.querySelector('#voting h1');
    if (votingHeader) votingHeader.textContent = title + ' Voting';

    const votingSubtitle = document.querySelector('#voting header p');
    if (votingSubtitle) votingSubtitle.textContent = subtitle;
  }

  buildVoteAmountSelector() {
    const amountSelector = document.querySelector('.amount-selector');
    if (!amountSelector) return;

    const currency = this.config.currency_symbol || '₵';
    amountSelector.innerHTML = '';

    this.voteRates.forEach(rate => {
      const option = document.createElement('div');
      option.className = 'amount-option';
      option.dataset.amount = rate.amount;
      option.dataset.votes = rate.votes;
      option.textContent = `${currency}${rate.amount} (${rate.votes} Vote${rate.votes !== 1 ? 's' : ''})`;
      option.addEventListener('click', () => this.selectAmount(rate.amount, rate.votes));
      amountSelector.appendChild(option);
    });
  }

  buildCategoriesAndNominees() {
    const votingDiv = document.getElementById('voting');
    const existingCategories = votingDiv.querySelectorAll('.award-category');
    existingCategories.forEach(cat => cat.remove());

    this.categories.forEach(category => {
      const categoryDiv = this.createCategorySection(category);
      votingDiv.appendChild(categoryDiv);
    });
  }

  createCategorySection(category) {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'award-category';

    const categoryNominees = this.nominees.filter(n => n.categoryId === category.id);

    let categoryHTML = `
      <h2>${category.displayOrder} - ${category.name}</h2>
      ${category.description ? `<p class="category-description">${category.description}</p>` : ''}
      <div class="nominees">
    `;

    categoryNominees.forEach(nominee => {
      const imageUrl = nominee.image ? pb.files.getUrl(nominee, nominee.image) : './logo.jpeg';
      categoryHTML += `
        <div class="nominee" data-id="${nominee.id}" data-name="${nominee.name}" data-category="${category.id}">
          <img src="${imageUrl}" alt="${nominee.name}" onerror="this.src='./logo.jpeg'" />
          <p>${nominee.name}</p>
          ${nominee.bio ? `<small class="nominee-bio">${nominee.bio}</small>` : ''}
          <div class="vote-count">Votes: <span>${nominee.totalVotes || 0}</span></div>
          <button class="btn vote-btn">Vote</button>
        </div>
      `;
    });

    categoryHTML += `</div>`;
    categoryDiv.innerHTML = categoryHTML;

    categoryDiv.querySelectorAll('.vote-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nominee = e.target.closest('.nominee');
        this.handleVote(nominee);
      });
    });

    return categoryDiv;
  }

  async subscribeToRealTimeUpdates() {
    pb.collection('nominees').subscribe('*', (e) => {
      if (e.action === 'update') {
        this.updateNomineeDisplay(e.record);
      }
    });

    pb.collection('app_config').subscribe('*', async (e) => {
      if (e.action === 'update') {
        await this.loadAppConfig();
        this.updatePageTitle();
        if (e.record.key === 'vote_conversion_rates') {
          this.buildVoteAmountSelector();
        }
      }
    });

    console.log('Subscribed to real-time updates');
  }

  updateNomineeDisplay(nominee) {
    const nomineeElement = document.querySelector(`[data-id="${nominee.id}"]`);
    if (nomineeElement) {
      const voteSpan = nomineeElement.querySelector('.vote-count span');
      voteSpan.textContent = nominee.totalVotes || 0;
    }
  }

  setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
    document.querySelector('.close').addEventListener('click', () => this.closeModal());
    document.getElementById('confirmPayment').addEventListener('click', () => this.processPayment());
  }

  async handleLogin(e) {
    e.preventDefault();
    const phone = document.getElementById('phoneNumber').value.trim();

    if (!/^[0-9]{9}$/.test(phone)) {
      alert('Please enter a valid 9-digit phone number');
      return;
    }

    const formattedPhone = `0${phone}`;

    try {
      if (!this.config.voting_enabled) {
        alert('Voting is currently disabled. Please try again later.');
        return;
      }

      let user = await this.findOrCreateUser(formattedPhone);
      const session = await this.createVotingSession(user.id);

      this.currentUser = user;
      this.currentSession = session;

      const userInfo = document.getElementById('userInfo');
      userInfo.textContent = `Welcome ${user.name || formattedPhone}! Select nominees and vote amount.`;

      // await this.logActivity('user_login', { phone: formattedPhone });
      window.showTab('voting');
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
    }
  }

  async findOrCreateUser(phone) {
    try {
      const existingUsers = await pb.collection('voters_info').getFullList({
        filter: `phone = "${phone}"`
      });

      if (existingUsers.length > 0) {
        const user = existingUsers[0];
        return await pb.collection('voters_info').update(user.id, {
          lastLogin: new Date().toISOString()
        });
      } else {
        return await pb.collection('voters_info').create({
          phone: phone,
          isActive: true,
          totalSpent: 0,
          totalVotes: 0,
          firstLogin: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error finding/creating user:', error);
      throw error;
    }
  }

  async createVotingSession(userId) {
    try {
      const sessionToken = this.generateSessionToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      return await pb.collection('voters_info').create({
        userId: userId,
        sessionToken: sessionToken,
        isActive: true,
        expiresAt: expiresAt.toISOString(),
        ipAddress: await this.getClientIP(),
        userAgent: navigator.userAgent
      });
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  generateSessionToken() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  selectAmount(amount, votes) {
    this.selectedAmount = amount;
    this.selectedVotes = votes;

    document.querySelectorAll('.amount-option').forEach(opt => {
      opt.classList.remove('selected');
    });
    event.target.classList.add('selected');

    document.getElementById('selectedAmount').textContent = amount;
    document.getElementById('selectedVotes').textContent = votes;
    document.getElementById('voteInfo').style.display = 'block';
  }

  handleVote(nominee) {
    if (!this.currentUser) {
      alert('Please login first');
      window.showTab('login');
      return;
    }

    if (!this.config.voting_enabled) {
      alert('Voting is currently disabled.');
      return;
    }

    if (this.selectedAmount === 0) {
      alert('Please select vote amount first');
      return;
    }

    this.currentNominee = {
      id: nominee.dataset.id,
      name: nominee.dataset.name,
      categoryId: nominee.dataset.category
    };

    this.showPaymentModal();
  }

  showPaymentModal() {
    const modal = document.getElementById('paymentModal');
    const details = document.getElementById('paymentDetails');
    const currency = this.config.currency_symbol || '₵';

    details.innerHTML = `
      <div style="text-align: center;">
        <h3>Payment Details</h3>
        <p><strong>Nominee:</strong> ${this.currentNominee.name}</p>
        <p><strong>Amount:</strong> ${currency}${this.selectedAmount}</p>
        <p><strong>Votes:</strong> ${this.selectedVotes}</p>
        <p><strong>Phone:</strong> ${this.currentUser.phone}</p>
        <div class="vote-info">
          A mobile money request will be sent to your phone
        </div>
      </div>
    `;

    modal.style.display = 'block';
  }

  closeModal() {
    document.getElementById('paymentModal').style.display = 'none';
  }

  async processPayment() {
    if (!this.config.paystack_public_key) {
      alert('Payment system not configured. Please contact administrator.');
      return;
    }

    const handler = PaystackPop.setup({
      key: this.config.paystack_public_key,
      email: this.currentUser.phone + '@votingapp.com',
      amount: this.selectedAmount * 100,
      currency: this.config.currency || 'GHS',
      channels: ['mobile_money'],
      metadata: {
        nomineeId: this.currentNominee.id,
        nomineeName: this.currentNominee.name,
        categoryId: this.currentNominee.categoryId,
        votes: this.selectedVotes,
        userId: this.currentUser.id
      },
      callback: (response) => this.handleSuccessfulPayment(response),
      onClose: () => console.log('Payment window closed')
    });

    handler.openIframe();
  }

  async handleSuccessfulPayment(response) {
    if (response.status === 'success') {
      try {
        await this.recordVote(response);

        const currency = this.config.currency_symbol || '₵';
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `
          <strong>Payment Successful!</strong><br>
          You've successfully voted for ${this.currentNominee.name} with ${this.selectedVotes} votes.<br>
          Amount: ${currency}${this.selectedAmount}<br>
          Transaction Reference: ${response.reference}
        `;

        document.querySelector('.vote-selection').appendChild(successDiv);

        this.resetVoteSelection();
        this.closeModal();

        setTimeout(() => {
          if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
          }
        }, 5000);
      } catch (error) {
        console.error('Error recording vote:', error);
        alert('Error recording vote. Please contact support with reference: ' + response.reference);
      }
    }
  }

  async recordVote(paymentResponse) {
    try {
      const voteRecord = await pb.collection('votes').create({
        userId: this.currentUser.id,
        nomineeId: this.currentNominee.id,
        categoryId: this.currentNominee.categoryId,
        votes: this.selectedVotes,
        amount: this.selectedAmount,
        transactionRef: paymentResponse.reference,
        paymentStatus: 'completed',
        paymentMethod: 'mobile_money'
      });

      const nominee = await pb.collection('nominees').getOne(this.currentNominee.id);
      await pb.collection('nominees').update(this.currentNominee.id, {
        totalVotes: (nominee.totalVotes || 0) + this.selectedVotes,
        totalAmount: (nominee.totalAmount || 0) + this.selectedAmount
      });

      await pb.collection('users').update(this.currentUser.id, {
        totalSpent: (this.currentUser.totalSpent || 0) + this.selectedAmount,
        totalVotes: (this.currentUser.totalVotes || 0) + this.selectedVotes
      });

      await this.logActivity('vote_cast', {
        nomineeId: this.currentNominee.id,
        nomineeName: this.currentNominee.name,
        votes: this.selectedVotes,
        amount: this.selectedAmount,
        transactionRef: paymentResponse.reference
      });

      console.log('Vote recorded successfully');
    } catch (error) {
      console.error('Error recording vote:', error);
      throw error;
    }
  }

  // async logActivity(action, details = {}) {
  //   try {
  //     await pb.collection('audit_logs').create({
  //       userId: this.currentUser?.id,
  //       action: action,
  //       details: details,
  //       ipAddress: await this.getClientIP(),
  //       userAgent: navigator.userAgent
  //     });
  //   } catch (error) {
  //     console.error('Error logging activity:', error);
  //   }
  // }

  async updateDashboard() {
    try {
      const [nominees, votes, users] = await Promise.all([
        pb.collection('nominees').getFullList({ filter: 'isActive = true' }),
        pb.collection('votes').getFullList({ filter: 'paymentStatus = "completed"' }),
        pb.collection('users').getFullList({ filter: 'isActive = true' })
      ]);

      const totalVotes = nominees.reduce((sum, nominee) => sum + (nominee.totalVotes || 0), 0);
      const totalRevenue = nominees.reduce((sum, nominee) => sum + (nominee.totalAmount || 0), 0);
      const totalVoters = users.filter(user => user.totalVotes > 0).length;
      const avgVoteValue = totalVoters > 0 ? (totalRevenue / totalVoters).toFixed(2) : 0;

      const currency = this.config.currency_symbol || '₵';

      document.getElementById('totalVotes').textContent = totalVotes;
      document.getElementById('totalRevenue').textContent = `${currency}${totalRevenue}`;
      document.getElementById('totalVoters').textContent = totalVoters;
      document.getElementById('avgVoteValue').textContent = `${currency}${avgVoteValue}`;

      this.updateLeaderboards(nominees);
    } catch (error) {
      console.error('Error updating dashboard:', error);
    }
  }

  updateLeaderboards(nominees) {
    const categoryLeaders = {};

    this.categories.forEach(category => {
      const categoryNominees = nominees.filter(n => n.categoryId === category.id);
      categoryNominees.sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0));
      categoryLeaders[category.id] = {
        category: category,
        nominees: categoryNominees
      };
    });

    let leaderboardHTML = '';
    const currency = this.config.currency_symbol || '₵';

    Object.values(categoryLeaders).forEach(({ category, nominees }) => {
      leaderboardHTML += `
        <div class="leaderboard">
          <h3>${category.displayOrder} - ${category.name}</h3>
      `;

      nominees.forEach((nominee, index) => {
        let rankClass = '';
        if (index === 0) rankClass = 'gold';
        else if (index === 1) rankClass = 'silver';
        else if (index === 2) rankClass = 'bronze';

        leaderboardHTML += `
          <div class="leaderboard-item">
            <div style="display: flex; align-items: center; gap: 15px;">
              <div class="rank ${rankClass}">${index + 1}</div>
              <div>
                <div style="font-weight: 600;">${nominee.name}</div>
                <div style="color: var(--color-text);">Votes: ${nominee.totalVotes || 0} | Amount: ${currency}${nominee.totalAmount || 0}</div>
              </div>
            </div>
          </div>
        `;
      });

      leaderboardHTML += `</div>`;
    });

    const leaderboardsContainer = document.getElementById('leaderboards');
    if (leaderboardsContainer) {
      leaderboardsContainer.innerHTML = leaderboardHTML;
    } else {
      console.warn('Leaderboards container not found');
    }
  }

  resetVoteSelection() {
    this.selectedAmount = 0;
    this.selectedVotes = 0;
    this.currentNominee = null;

    document.querySelectorAll('.amount-option').forEach(opt => {
      opt.classList.remove('selected');
    });
    document.getElementById('voteInfo').style.display = 'none';
  }

  showError(message) {
    alert(message);
  }
}

// Initialize the voting system
let votingSystem;
document.addEventListener('DOMContentLoaded', function () {
  votingSystem = new DynamicVotingSystem();
  votingSystem.init();
});

// Global showTab function
window.showTab = function (tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });

  document.getElementById(tabName).classList.add('active');
  document.querySelector(`.tab-button[onclick="showTab('${tabName}')"]`).classList.add('active');

  if (tabName === 'dashboard') {
    votingSystem.updateDashboard();
  }
};