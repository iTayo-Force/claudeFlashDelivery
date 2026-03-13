import { create } from 'zustand';

export type Locale = 'fr' | 'en';

interface Translations {
  [key: string]: string;
}

const fr: Translations = {
  // General
  'app.name': 'Claude Flash Delivery',
  'app.tagline': 'Livraison rapide au Cameroun',
  'app.description': 'Envoyez vos colis partout au Cameroun en quelques clics. Rapide, fiable, abordable.',

  // Auth
  'auth.login': 'Se connecter',
  'auth.register': 'Créer un compte',
  'auth.logout': 'Se déconnecter',
  'auth.employee': 'Espace Employé',
  'auth.welcomeBack': 'Bon retour !',
  'auth.loginSubtitle': 'Connectez-vous pour gérer vos livraisons',
  'auth.registerTitle': 'Créer un compte',
  'auth.registerSubtitle': 'Rejoignez Claude Flash Delivery',
  'auth.noAccount': 'Pas encore de compte ? Inscrivez-vous',
  'auth.hasAccount': 'Déjà inscrit ? Connectez-vous',
  'auth.phone': 'Téléphone',
  'auth.password': 'Mot de passe',
  'auth.email': 'Email',
  'auth.emailOptional': 'Email (optionnel)',
  'auth.firstName': 'Prénom',
  'auth.lastName': 'Nom',
  'auth.confirmPassword': 'Confirmer le mot de passe',
  'auth.passwordMin': 'Min. 8 caractères',
  'auth.employeeEmail': 'Email professionnel',

  // Home
  'home.greeting': 'Bonjour',
  'home.whatToSend': 'Que souhaitez-vous envoyer aujourd\'hui ?',
  'home.newDelivery': 'Nouvelle livraison',
  'home.newDeliverySub': 'Envoyez un colis en quelques clics',
  'home.track': 'Suivre',
  'home.pricing': 'Tarifs',
  'home.support': 'Support',
  'home.recentDeliveries': 'Livraisons récentes',
  'home.seeAll': 'Voir tout',
  'home.noDeliveries': 'Aucune livraison pour le moment',
  'home.startFirst': 'Commencez par envoyer votre premier colis !',

  // Deliveries
  'delivery.new': 'Nouvelle livraison',
  'delivery.my': 'Mes Colis',
  'delivery.all': 'Toutes',
  'delivery.pickup': 'Point de ramassage',
  'delivery.dropoff': 'Point de livraison',
  'delivery.package': 'Détails du colis',
  'delivery.review': 'Récapitulatif',
  'delivery.pickupAddress': 'Adresse de ramassage',
  'delivery.deliveryAddress': 'Adresse de livraison',
  'delivery.contactName': 'Nom du contact',
  'delivery.contactPhone': 'Téléphone du contact',
  'delivery.recipientName': 'Nom du destinataire',
  'delivery.recipientPhone': 'Téléphone du destinataire',
  'delivery.description': 'Description',
  'delivery.descriptionPlaceholder': 'Que contient le colis ?',
  'delivery.packageSize': 'Taille du colis',
  'delivery.fragile': 'Colis fragile',
  'delivery.notes': 'Notes (optionnel)',
  'delivery.notesPlaceholder': 'Instructions spéciales...',
  'delivery.next': 'Suivant',
  'delivery.previous': 'Précédent',
  'delivery.confirm': 'Confirmer la livraison',
  'delivery.estimatedCost': 'Coût estimé',
  'delivery.cancel': 'Annuler la livraison',
  'delivery.cancelConfirm': 'Êtes-vous sûr de vouloir annuler cette livraison ?',
  'delivery.callDriver': 'Appeler le chauffeur',
  'delivery.driver': 'Chauffeur',
  'delivery.none': 'Aucune livraison trouvée',

  // Statuses
  'status.pending': 'En attente',
  'status.confirmed': 'Confirmée',
  'status.assigned': 'Assignée',
  'status.picked_up': 'Ramassée',
  'status.in_transit': 'En transit',
  'status.delivered': 'Livrée',
  'status.cancelled': 'Annulée',
  'status.failed': 'Échouée',

  // Package sizes
  'size.small': 'Petit (< 5kg)',
  'size.medium': 'Moyen (5-15kg)',
  'size.large': 'Grand (15-30kg)',
  'size.xl': 'Très grand (> 30kg)',

  // Payment
  'payment.title': 'Paiement mobile',
  'payment.amount': 'Montant à payer',
  'payment.provider': 'Moyen de paiement',
  'payment.phone': 'Numéro',
  'payment.pay': 'Payer',
  'payment.pending': 'En attente de confirmation',
  'payment.pendingText': 'Veuillez valider le paiement sur votre téléphone.',
  'payment.success': 'Paiement réussi !',
  'payment.failed': 'Paiement échoué',
  'payment.retry': 'Réessayer',

  // Profile
  'profile.title': 'Profil',
  'profile.deliveries': 'Mes livraisons',
  'profile.payments': 'Moyens de paiement',
  'profile.addresses': 'Adresses enregistrées',
  'profile.notifications': 'Notifications',
  'profile.language': 'Langue',
  'profile.help': 'Centre d\'aide',
  'profile.terms': 'Conditions d\'utilisation',
  'profile.privacy': 'Politique de confidentialité',

  // Tracking
  'tracking.live': 'Suivi en direct',
  'tracking.connecting': 'Connexion...',

  // Admin
  'admin.dashboard': 'Tableau de bord',
  'admin.deliveries': 'Livraisons',
  'admin.operations': 'Opérations',
  'admin.routes': 'Itinéraires',
  'admin.welcome': 'Bienvenue',
  'admin.manageDeliveries': 'Gérer livraisons',
  'admin.assignDrivers': 'Assigner chauffeurs',
  'admin.reports': 'Rapports',
  'admin.todayOrders': 'Nouvelles commandes',
  'admin.inProgress': 'En cours',
  'admin.deliveredToday': 'Livrées aujourd\'hui',
  'admin.toProcess': 'À traiter',
  'admin.activeRoutes': 'Itinéraires actifs',
  'admin.deliveriesInProgress': 'livraisons en cours',

  // Common
  'common.or': 'ou',
  'common.back': 'Retour',
  'common.error': 'Erreur',
  'common.success': 'Succès',
  'common.loading': 'Chargement...',
  'common.cancel': 'Annuler',
  'common.yes': 'Oui',
  'common.no': 'Non',
  'common.save': 'Enregistrer',
  'common.fillRequired': 'Veuillez remplir tous les champs',
  'common.passwordMismatch': 'Les mots de passe ne correspondent pas',
};

const en: Translations = {
  // General
  'app.name': 'Claude Flash Delivery',
  'app.tagline': 'Fast delivery in Cameroon',
  'app.description': 'Send your packages anywhere in Cameroon in just a few clicks. Fast, reliable, affordable.',

  // Auth
  'auth.login': 'Sign In',
  'auth.register': 'Create Account',
  'auth.logout': 'Sign Out',
  'auth.employee': 'Employee Portal',
  'auth.welcomeBack': 'Welcome back!',
  'auth.loginSubtitle': 'Sign in to manage your deliveries',
  'auth.registerTitle': 'Create Account',
  'auth.registerSubtitle': 'Join Claude Flash Delivery',
  'auth.noAccount': 'Don\'t have an account? Sign up',
  'auth.hasAccount': 'Already registered? Sign in',
  'auth.phone': 'Phone',
  'auth.password': 'Password',
  'auth.email': 'Email',
  'auth.emailOptional': 'Email (optional)',
  'auth.firstName': 'First Name',
  'auth.lastName': 'Last Name',
  'auth.confirmPassword': 'Confirm Password',
  'auth.passwordMin': 'Min. 8 characters',
  'auth.employeeEmail': 'Professional email',

  // Home
  'home.greeting': 'Hello',
  'home.whatToSend': 'What would you like to send today?',
  'home.newDelivery': 'New delivery',
  'home.newDeliverySub': 'Send a package in a few clicks',
  'home.track': 'Track',
  'home.pricing': 'Pricing',
  'home.support': 'Support',
  'home.recentDeliveries': 'Recent deliveries',
  'home.seeAll': 'See all',
  'home.noDeliveries': 'No deliveries yet',
  'home.startFirst': 'Start by sending your first package!',

  // Deliveries
  'delivery.new': 'New delivery',
  'delivery.my': 'My Packages',
  'delivery.all': 'All',
  'delivery.pickup': 'Pickup point',
  'delivery.dropoff': 'Delivery point',
  'delivery.package': 'Package details',
  'delivery.review': 'Summary',
  'delivery.pickupAddress': 'Pickup address',
  'delivery.deliveryAddress': 'Delivery address',
  'delivery.contactName': 'Contact name',
  'delivery.contactPhone': 'Contact phone',
  'delivery.recipientName': 'Recipient name',
  'delivery.recipientPhone': 'Recipient phone',
  'delivery.description': 'Description',
  'delivery.descriptionPlaceholder': 'What does the package contain?',
  'delivery.packageSize': 'Package size',
  'delivery.fragile': 'Fragile package',
  'delivery.notes': 'Notes (optional)',
  'delivery.notesPlaceholder': 'Special instructions...',
  'delivery.next': 'Next',
  'delivery.previous': 'Previous',
  'delivery.confirm': 'Confirm delivery',
  'delivery.estimatedCost': 'Estimated cost',
  'delivery.cancel': 'Cancel delivery',
  'delivery.cancelConfirm': 'Are you sure you want to cancel this delivery?',
  'delivery.callDriver': 'Call driver',
  'delivery.driver': 'Driver',
  'delivery.none': 'No deliveries found',

  // Statuses
  'status.pending': 'Pending',
  'status.confirmed': 'Confirmed',
  'status.assigned': 'Assigned',
  'status.picked_up': 'Picked up',
  'status.in_transit': 'In transit',
  'status.delivered': 'Delivered',
  'status.cancelled': 'Cancelled',
  'status.failed': 'Failed',

  // Package sizes
  'size.small': 'Small (< 5kg)',
  'size.medium': 'Medium (5-15kg)',
  'size.large': 'Large (15-30kg)',
  'size.xl': 'Extra large (> 30kg)',

  // Payment
  'payment.title': 'Mobile Payment',
  'payment.amount': 'Amount to pay',
  'payment.provider': 'Payment method',
  'payment.phone': 'Phone number',
  'payment.pay': 'Pay',
  'payment.pending': 'Awaiting confirmation',
  'payment.pendingText': 'Please confirm the payment on your phone.',
  'payment.success': 'Payment successful!',
  'payment.failed': 'Payment failed',
  'payment.retry': 'Retry',

  // Profile
  'profile.title': 'Profile',
  'profile.deliveries': 'My deliveries',
  'profile.payments': 'Payment methods',
  'profile.addresses': 'Saved addresses',
  'profile.notifications': 'Notifications',
  'profile.language': 'Language',
  'profile.help': 'Help center',
  'profile.terms': 'Terms of service',
  'profile.privacy': 'Privacy policy',

  // Tracking
  'tracking.live': 'Live tracking',
  'tracking.connecting': 'Connecting...',

  // Admin
  'admin.dashboard': 'Dashboard',
  'admin.deliveries': 'Deliveries',
  'admin.operations': 'Operations',
  'admin.routes': 'Routes',
  'admin.welcome': 'Welcome',
  'admin.manageDeliveries': 'Manage deliveries',
  'admin.assignDrivers': 'Assign drivers',
  'admin.reports': 'Reports',
  'admin.todayOrders': 'New orders',
  'admin.inProgress': 'In progress',
  'admin.deliveredToday': 'Delivered today',
  'admin.toProcess': 'To process',
  'admin.activeRoutes': 'Active routes',
  'admin.deliveriesInProgress': 'deliveries in progress',

  // Common
  'common.or': 'or',
  'common.back': 'Back',
  'common.error': 'Error',
  'common.success': 'Success',
  'common.loading': 'Loading...',
  'common.cancel': 'Cancel',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.save': 'Save',
  'common.fillRequired': 'Please fill in all required fields',
  'common.passwordMismatch': 'Passwords do not match',
};

const translations: Record<Locale, Translations> = { fr, en };

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

export const useI18n = create<I18nState>((set, get) => ({
  locale: 'fr',
  setLocale: (locale) => set({ locale }),
  t: (key) => {
    const { locale } = get();
    return translations[locale][key] || translations.fr[key] || key;
  },
}));
