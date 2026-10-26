import { calculateDistance, LatLng } from '../../core/utils/response';
import { PINCodeInfo, ParsedIndianAddress } from './pincode.types';

interface PostalSubzoneMetadata {
  state: string;
  circle: string;
  district: string;
  center: LatLng;
  boundingBox: [number, number, number, number];
}

export class PINCodeService {
  /**
   * Primary Directory of Major Indian Post Offices, Commercial Hubs, and State Capitals
   */
  private readonly directory: Record<string, PINCodeInfo> = {
    // Delhi NCR
    '110001': {
      pincode: '110001',
      postOffice: 'Connaught Place H.O',
      district: 'Central Delhi',
      state: 'Delhi',
      circle: 'Delhi Circle',
      center: { latitude: 28.6304, longitude: 77.2177 },
      boundingBox: [77.2, 28.61, 77.24, 28.65],
    },
    '110016': {
      pincode: '110016',
      postOffice: 'Hauz Khas S.O',
      district: 'South Delhi',
      state: 'Delhi',
      circle: 'Delhi Circle',
      center: { latitude: 28.5494, longitude: 77.2001 },
      boundingBox: [77.18, 28.53, 77.22, 28.57],
    },
    '110020': {
      pincode: '110020',
      postOffice: 'Okhla Industrial Area Phase-I S.O',
      district: 'South East Delhi',
      state: 'Delhi',
      circle: 'Delhi Circle',
      center: { latitude: 28.5284, longitude: 77.2754 },
      boundingBox: [77.25, 28.5, 77.3, 28.55],
    },
    '110085': {
      pincode: '110085',
      postOffice: 'Rohini Sector 7 S.O',
      district: 'North West Delhi',
      state: 'Delhi',
      circle: 'Delhi Circle',
      center: { latitude: 28.7126, longitude: 77.1147 },
      boundingBox: [77.08, 28.69, 77.14, 28.74],
    },
    '122001': {
      pincode: '122001',
      postOffice: 'Gurgaon H.O',
      district: 'Gurugram',
      state: 'Haryana',
      circle: 'Haryana Circle',
      center: { latitude: 28.4595, longitude: 77.0266 },
      boundingBox: [76.99, 28.43, 77.06, 28.49],
    },
    '122002': {
      pincode: '122002',
      postOffice: 'DLF Cyber City S.O',
      district: 'Gurugram',
      state: 'Haryana',
      circle: 'Haryana Circle',
      center: { latitude: 28.4947, longitude: 77.0886 },
      boundingBox: [77.06, 28.47, 77.11, 28.52],
    },
    '201301': {
      pincode: '201301',
      postOffice: 'Noida Sector 1 H.O',
      district: 'Gautam Buddha Nagar',
      state: 'Uttar Pradesh',
      circle: 'Uttar Pradesh Circle',
      center: { latitude: 28.5833, longitude: 77.3167 },
      boundingBox: [77.29, 28.55, 77.35, 28.61],
    },

    // Mumbai & Maharashtra
    '400001': {
      pincode: '400001',
      postOffice: 'Mumbai G.P.O.',
      district: 'Mumbai',
      state: 'Maharashtra',
      circle: 'Maharashtra Circle',
      center: { latitude: 18.9401, longitude: 72.8354 },
      boundingBox: [72.82, 18.92, 72.85, 18.96],
    },
    '400050': {
      pincode: '400050',
      postOffice: 'Bandra West S.O',
      district: 'Mumbai Suburban',
      state: 'Maharashtra',
      circle: 'Maharashtra Circle',
      center: { latitude: 19.0596, longitude: 72.8295 },
      boundingBox: [72.81, 19.04, 72.85, 19.08],
    },
    '400051': {
      pincode: '400051',
      postOffice: 'Bandra Kurla Complex (BKC) S.O',
      district: 'Mumbai Suburban',
      state: 'Maharashtra',
      circle: 'Maharashtra Circle',
      center: { latitude: 19.0657, longitude: 72.8687 },
      boundingBox: [72.85, 19.04, 72.89, 19.09],
    },
    '411001': {
      pincode: '411001',
      postOffice: 'Pune G.P.O.',
      district: 'Pune',
      state: 'Maharashtra',
      circle: 'Maharashtra Circle',
      center: { latitude: 18.5204, longitude: 73.8567 },
      boundingBox: [73.83, 18.5, 73.88, 18.54],
    },

    // Bengaluru & Karnataka
    '560001': {
      pincode: '560001',
      postOffice: 'Bangalore G.P.O.',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      circle: 'Karnataka Circle',
      center: { latitude: 12.9784, longitude: 77.5994 },
      boundingBox: [77.58, 12.96, 77.62, 13.0],
    },
    '560034': {
      pincode: '560034',
      postOffice: 'Koramangala S.O',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      circle: 'Karnataka Circle',
      center: { latitude: 12.9352, longitude: 77.6245 },
      boundingBox: [77.6, 12.91, 77.65, 12.96],
    },
    '560100': {
      pincode: '560100',
      postOffice: 'Electronic City S.O',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      circle: 'Karnataka Circle',
      center: { latitude: 12.8399, longitude: 77.677 },
      boundingBox: [77.65, 12.82, 77.71, 12.86],
    },

    // Hyderabad & Telangana
    '500001': {
      pincode: '500001',
      postOffice: 'Hyderabad G.P.O.',
      district: 'Hyderabad',
      state: 'Telangana',
      circle: 'Telangana Circle',
      center: { latitude: 17.385, longitude: 78.4867 },
      boundingBox: [78.46, 17.36, 78.51, 17.41],
    },
    '500081': {
      pincode: '500081',
      postOffice: 'HITEC City S.O',
      district: 'Hyderabad',
      state: 'Telangana',
      circle: 'Telangana Circle',
      center: { latitude: 17.4435, longitude: 78.3772 },
      boundingBox: [78.35, 17.42, 78.4, 17.47],
    },

    // Chennai & Tamil Nadu
    '600001': {
      pincode: '600001',
      postOffice: 'Chennai G.P.O.',
      district: 'Chennai',
      state: 'Tamil Nadu',
      circle: 'Tamil Nadu Circle',
      center: { latitude: 13.09, longitude: 80.289 },
      boundingBox: [80.26, 13.07, 80.31, 13.11],
    },
    '600096': {
      pincode: '600096',
      postOffice: 'Perungudi OMR IT Corridor S.O',
      district: 'Chennai',
      state: 'Tamil Nadu',
      circle: 'Tamil Nadu Circle',
      center: { latitude: 12.9654, longitude: 80.2461 },
      boundingBox: [80.22, 12.94, 80.27, 12.99],
    },

    // Kolkata & West Bengal
    '700001': {
      pincode: '700001',
      postOffice: 'Kolkata G.P.O.',
      district: 'Kolkata',
      state: 'West Bengal',
      circle: 'West Bengal Circle',
      center: { latitude: 22.5726, longitude: 88.3639 },
      boundingBox: [88.34, 22.55, 88.39, 22.6],
    },
    '700091': {
      pincode: '700091',
      postOffice: 'Salt Lake Sector V S.O',
      district: 'North 24 Parganas',
      state: 'West Bengal',
      circle: 'West Bengal Circle',
      center: { latitude: 22.5802, longitude: 88.4312 },
      boundingBox: [88.41, 22.56, 88.46, 22.61],
    },

    // Ahmedabad & Gujarat
    '380001': {
      pincode: '380001',
      postOffice: 'Ahmedabad G.P.O.',
      district: 'Ahmedabad',
      state: 'Gujarat',
      circle: 'Gujarat Circle',
      center: { latitude: 23.0225, longitude: 72.5714 },
      boundingBox: [72.55, 23.0, 72.6, 23.05],
    },

    // Jaipur & Rajasthan
    '302001': {
      pincode: '302001',
      postOffice: 'Jaipur G.P.O.',
      district: 'Jaipur',
      state: 'Rajasthan',
      circle: 'Rajasthan Circle',
      center: { latitude: 26.9124, longitude: 75.7873 },
      boundingBox: [75.76, 26.89, 75.82, 26.94],
    },

    // Lucknow & Uttar Pradesh
    '226001': {
      pincode: '226001',
      postOffice: 'Lucknow G.P.O.',
      district: 'Lucknow',
      state: 'Uttar Pradesh',
      circle: 'Uttar Pradesh Circle',
      center: { latitude: 26.8467, longitude: 80.9462 },
      boundingBox: [80.92, 26.82, 80.97, 26.87],
    },

    // Kochi & Kerala
    '682001': {
      pincode: '682001',
      postOffice: 'Ernakulam H.O (Kochi)',
      district: 'Ernakulam',
      state: 'Kerala',
      circle: 'Kerala Circle',
      center: { latitude: 9.9816, longitude: 76.2999 },
      boundingBox: [76.27, 9.96, 76.33, 10.01],
    },

    // Patna & Bihar
    '800001': {
      pincode: '800001',
      postOffice: 'Patna G.P.O.',
      district: 'Patna',
      state: 'Bihar',
      circle: 'Bihar Circle',
      center: { latitude: 25.5941, longitude: 85.1376 },
      boundingBox: [85.11, 25.57, 85.16, 25.62],
    },

    // Chandigarh (Punjab & Haryana)
    '160017': {
      pincode: '160017',
      postOffice: 'Sector 17 G.P.O. Chandigarh',
      district: 'Chandigarh',
      state: 'Chandigarh',
      circle: 'Punjab Circle',
      center: { latitude: 30.7333, longitude: 76.7794 },
      boundingBox: [76.75, 30.71, 76.81, 30.76],
    },

    // Guwahati & Assam
    '781001': {
      pincode: '781001',
      postOffice: 'Guwahati G.P.O.',
      district: 'Kamrup Metropolitan',
      state: 'Assam',
      circle: 'Assam Circle',
      center: { latitude: 26.1862, longitude: 91.7483 },
      boundingBox: [76.72, 26.16, 91.78, 26.21],
    },
  };

  /**
   * 2-Digit Postal Subzone Hierarchy mapping for all 28 Indian States & 8 UTs
   */
  private readonly subzonePrefixMap: Record<string, PostalSubzoneMetadata> = {
    '11': { state: 'Delhi', circle: 'Delhi Circle', district: 'Delhi NCR', center: { latitude: 28.6139, longitude: 77.209 }, boundingBox: [76.85, 28.4, 77.35, 28.88] },
    '12': { state: 'Haryana', circle: 'Haryana Circle', district: 'Gurugram / Faridabad', center: { latitude: 28.4595, longitude: 77.0266 }, boundingBox: [76.28, 27.8, 77.4, 29.5] },
    '13': { state: 'Haryana', circle: 'Haryana Circle', district: 'Ambala / Kurukshetra / Panchkula', center: { latitude: 30.3782, longitude: 76.7767 }, boundingBox: [76.2, 29.5, 77.3, 30.6] },
    '14': { state: 'Punjab', circle: 'Punjab Circle', district: 'Ludhiana / Jalandhar', center: { latitude: 30.901, longitude: 75.8573 }, boundingBox: [75.0, 30.3, 76.5, 31.8] },
    '15': { state: 'Punjab', circle: 'Punjab Circle', district: 'Bathinda / Firozpur', center: { latitude: 30.211, longitude: 74.9455 }, boundingBox: [74.0, 29.8, 75.8, 31.0] },
    '16': { state: 'Chandigarh / Punjab', circle: 'Punjab Circle', district: 'Chandigarh / Mohali', center: { latitude: 30.7333, longitude: 76.7794 }, boundingBox: [76.6, 30.6, 76.9, 30.85] },
    '17': { state: 'Himachal Pradesh', circle: 'Himachal Pradesh Circle', district: 'Shimla / Kangra', center: { latitude: 31.1048, longitude: 77.1734 }, boundingBox: [75.8, 30.5, 78.5, 33.2] },
    '18': { state: 'Jammu & Kashmir', circle: 'Jammu & Kashmir Circle', district: 'Jammu / Udhampur', center: { latitude: 32.7266, longitude: 74.857 }, boundingBox: [74.0, 32.2, 76.2, 33.5] },
    '19': { state: 'Jammu & Kashmir / Ladakh', circle: 'Jammu & Kashmir Circle', district: 'Srinagar / Leh', center: { latitude: 34.0837, longitude: 74.7973 }, boundingBox: [73.5, 33.0, 78.5, 35.5] },
    '20': { state: 'Uttar Pradesh', circle: 'Uttar Pradesh Circle', district: 'Noida / Ghaziabad / Aligarh', center: { latitude: 28.5833, longitude: 77.3167 }, boundingBox: [77.0, 27.5, 78.5, 29.0] },
    '21': { state: 'Uttar Pradesh', circle: 'Uttar Pradesh Circle', district: 'Prayagraj / Fatehpur', center: { latitude: 25.4358, longitude: 81.8463 }, boundingBox: [80.5, 24.8, 82.5, 26.2] },
    '22': { state: 'Uttar Pradesh', circle: 'Uttar Pradesh Circle', district: 'Lucknow / Barabanki', center: { latitude: 26.8467, longitude: 80.9462 }, boundingBox: [80.2, 26.3, 81.8, 27.4] },
    '23': { state: 'Uttar Pradesh', circle: 'Uttar Pradesh Circle', district: 'Varanasi / Mirzapur', center: { latitude: 25.3176, longitude: 82.9739 }, boundingBox: [82.2, 24.5, 83.8, 25.9] },
    '24': { state: 'Uttarakhand / UP', circle: 'Uttarakhand Circle', district: 'Dehradun / Haridwar', center: { latitude: 30.3165, longitude: 78.0322 }, boundingBox: [77.5, 29.5, 79.5, 31.0] },
    '25': { state: 'Uttar Pradesh', circle: 'Uttar Pradesh Circle', district: 'Meerut / Saharanpur', center: { latitude: 28.9845, longitude: 77.7064 }, boundingBox: [77.2, 28.5, 78.2, 30.0] },
    '26': { state: 'Uttarakhand / UP', circle: 'Uttarakhand Circle', district: 'Nainital / Almora', center: { latitude: 29.3919, longitude: 79.4542 }, boundingBox: [78.8, 28.8, 80.5, 30.2] },
    '27': { state: 'Uttar Pradesh', circle: 'Uttar Pradesh Circle', district: 'Gorakhpur / Basti', center: { latitude: 26.7606, longitude: 83.3732 }, boundingBox: [82.5, 26.0, 84.4, 27.5] },
    '28': { state: 'Uttar Pradesh', circle: 'Uttar Pradesh Circle', district: 'Agra / Mathura / Jhansi', center: { latitude: 27.1767, longitude: 78.0081 }, boundingBox: [77.3, 25.0, 79.2, 27.8] },
    '30': { state: 'Rajasthan', circle: 'Rajasthan Circle', district: 'Jaipur / Alwar', center: { latitude: 26.9124, longitude: 75.7873 }, boundingBox: [75.0, 26.2, 76.8, 27.8] },
    '31': { state: 'Rajasthan', circle: 'Rajasthan Circle', district: 'Kota / Udaipur', center: { latitude: 25.2138, longitude: 75.8648 }, boundingBox: [73.2, 24.0, 76.8, 25.8] },
    '32': { state: 'Rajasthan', circle: 'Rajasthan Circle', district: 'Bharatpur / Dholpur', center: { latitude: 27.2152, longitude: 77.503 }, boundingBox: [76.5, 26.5, 78.2, 27.8] },
    '33': { state: 'Rajasthan', circle: 'Rajasthan Circle', district: 'Bikaner / Sri Ganganagar', center: { latitude: 28.0229, longitude: 73.3119 }, boundingBox: [72.0, 27.2, 74.8, 30.1] },
    '34': { state: 'Rajasthan', circle: 'Rajasthan Circle', district: 'Jodhpur / Jaisalmer / Barmer', center: { latitude: 26.2389, longitude: 73.0243 }, boundingBox: [70.0, 25.0, 74.0, 27.5] },
    '36': { state: 'Gujarat', circle: 'Gujarat Circle', district: 'Rajkot / Bhavnagar', center: { latitude: 22.3039, longitude: 70.8022 }, boundingBox: [69.5, 21.0, 72.0, 23.0] },
    '37': { state: 'Gujarat', circle: 'Gujarat Circle', district: 'Kutch / Bhuj', center: { latitude: 23.242, longitude: 69.6669 }, boundingBox: [68.5, 22.5, 71.0, 24.5] },
    '38': { state: 'Gujarat', circle: 'Gujarat Circle', district: 'Ahmedabad / Gandhinagar', center: { latitude: 23.0225, longitude: 72.5714 }, boundingBox: [72.2, 22.5, 73.0, 23.5] },
    '39': { state: 'Gujarat', circle: 'Gujarat Circle', district: 'Surat / Vadodara', center: { latitude: 21.1702, longitude: 72.8311 }, boundingBox: [72.5, 20.5, 73.8, 22.6] },
    '40': { state: 'Maharashtra', circle: 'Maharashtra Circle', district: 'Mumbai / Thane', center: { latitude: 18.9401, longitude: 72.8354 }, boundingBox: [72.7, 18.8, 73.2, 19.4] },
    '41': { state: 'Maharashtra', circle: 'Maharashtra Circle', district: 'Pune / Satara / Solapur', center: { latitude: 18.5204, longitude: 73.8567 }, boundingBox: [73.2, 17.5, 75.8, 19.0] },
    '42': { state: 'Maharashtra', circle: 'Maharashtra Circle', district: 'Nashik / Dhule / Jalgaon', center: { latitude: 19.9975, longitude: 73.7898 }, boundingBox: [73.5, 19.5, 75.5, 21.5] },
    '43': { state: 'Maharashtra', circle: 'Maharashtra Circle', district: 'Chhatrapati Sambhajinagar (Aurangabad) / Nanded', center: { latitude: 19.8762, longitude: 75.3433 }, boundingBox: [74.5, 18.5, 77.8, 20.8] },
    '44': { state: 'Maharashtra', circle: 'Maharashtra Circle', district: 'Nagpur / Amravati', center: { latitude: 21.1458, longitude: 79.0882 }, boundingBox: [77.0, 20.0, 80.5, 22.0] },
    '45': { state: 'Madhya Pradesh', circle: 'Madhya Pradesh Circle', district: 'Indore / Ujjain', center: { latitude: 22.7196, longitude: 75.8577 }, boundingBox: [75.0, 22.0, 76.5, 23.5] },
    '46': { state: 'Madhya Pradesh', circle: 'Madhya Pradesh Circle', district: 'Bhopal / Hoshangabad', center: { latitude: 23.2599, longitude: 77.4126 }, boundingBox: [76.8, 22.5, 78.5, 24.0] },
    '47': { state: 'Madhya Pradesh', circle: 'Madhya Pradesh Circle', district: 'Gwalior / Morena', center: { latitude: 26.2183, longitude: 78.1828 }, boundingBox: [77.5, 25.5, 79.0, 26.8] },
    '48': { state: 'Madhya Pradesh', circle: 'Madhya Pradesh Circle', district: 'Jabalpur / Rewa', center: { latitude: 23.1815, longitude: 79.9864 }, boundingBox: [79.0, 22.5, 82.0, 24.8] },
    '49': { state: 'Chhattisgarh', circle: 'Chhattisgarh Circle', district: 'Raipur / Bilaspur', center: { latitude: 21.2514, longitude: 81.6296 }, boundingBox: [80.5, 18.5, 83.5, 23.5] },
    '50': { state: 'Telangana', circle: 'Telangana Circle', district: 'Hyderabad / Secunderabad / Rangareddy', center: { latitude: 17.385, longitude: 78.4867 }, boundingBox: [78.0, 16.8, 79.2, 18.0] },
    '51': { state: 'Andhra Pradesh', circle: 'Andhra Pradesh Circle', district: 'Kurnool / Kadapa', center: { latitude: 15.8281, longitude: 78.0373 }, boundingBox: [77.0, 14.0, 79.0, 16.5] },
    '52': { state: 'Andhra Pradesh', circle: 'Andhra Pradesh Circle', district: 'Vijayawada / Guntur', center: { latitude: 16.5062, longitude: 80.648 }, boundingBox: [79.8, 15.5, 81.5, 17.0] },
    '53': { state: 'Andhra Pradesh', circle: 'Andhra Pradesh Circle', district: 'Visakhapatnam / Rajahmundry', center: { latitude: 17.6868, longitude: 83.2185 }, boundingBox: [81.5, 16.8, 84.0, 19.0] },
    '56': { state: 'Karnataka', circle: 'Karnataka Circle', district: 'Bengaluru Urban / Rural', center: { latitude: 12.9716, longitude: 77.5946 }, boundingBox: [77.2, 12.7, 77.8, 13.3] },
    '57': { state: 'Karnataka', circle: 'Karnataka Circle', district: 'Mysuru / Mangaluru / Udupi', center: { latitude: 12.2958, longitude: 76.6394 }, boundingBox: [74.5, 11.8, 77.0, 13.5] },
    '58': { state: 'Karnataka', circle: 'Karnataka Circle', district: 'Hubballi-Dharwad / Belagavi', center: { latitude: 15.3647, longitude: 75.124 }, boundingBox: [74.0, 14.5, 76.5, 16.5] },
    '59': { state: 'Karnataka', circle: 'Karnataka Circle', district: 'Kalaburagi / Ballari', center: { latitude: 17.3297, longitude: 76.8343 }, boundingBox: [76.0, 15.0, 77.8, 18.0] },
    '60': { state: 'Tamil Nadu', circle: 'Tamil Nadu Circle', district: 'Chennai / Chengalpattu', center: { latitude: 13.0827, longitude: 80.2707 }, boundingBox: [79.8, 12.8, 80.4, 13.3] },
    '61': { state: 'Tamil Nadu', circle: 'Tamil Nadu Circle', district: 'Thanjavur / Nagapattinam', center: { latitude: 10.787, longitude: 79.1378 }, boundingBox: [78.8, 10.2, 80.0, 11.2] },
    '62': { state: 'Tamil Nadu', circle: 'Tamil Nadu Circle', district: 'Madurai / Dindigul', center: { latitude: 9.9252, longitude: 78.1198 }, boundingBox: [77.5, 9.2, 78.8, 10.5] },
    '63': { state: 'Tamil Nadu', circle: 'Tamil Nadu Circle', district: 'Tiruchirappalli / Salem', center: { latitude: 10.7905, longitude: 78.7047 }, boundingBox: [77.8, 10.5, 79.2, 12.0] },
    '64': { state: 'Tamil Nadu', circle: 'Tamil Nadu Circle', district: 'Coimbatore / Tiruppur', center: { latitude: 11.0168, longitude: 76.9558 }, boundingBox: [76.5, 10.5, 77.8, 11.8] },
    '67': { state: 'Kerala', circle: 'Kerala Circle', district: 'Kozhikode / Kannur', center: { latitude: 11.2588, longitude: 75.7804 }, boundingBox: [74.8, 11.0, 76.2, 12.5] },
    '68': { state: 'Kerala', circle: 'Kerala Circle', district: 'Kochi (Ernakulam) / Thrissur', center: { latitude: 9.9816, longitude: 76.2999 }, boundingBox: [76.0, 9.5, 76.8, 10.8] },
    '69': { state: 'Kerala', circle: 'Kerala Circle', district: 'Thiruvananthapuram / Kollam', center: { latitude: 8.5241, longitude: 76.9366 }, boundingBox: [76.5, 8.3, 77.5, 9.5] },
    '70': { state: 'West Bengal', circle: 'West Bengal Circle', district: 'Kolkata / Howrah', center: { latitude: 22.5726, longitude: 88.3639 }, boundingBox: [88.2, 22.4, 88.5, 22.7] },
    '71': { state: 'West Bengal', circle: 'West Bengal Circle', district: 'Asansol / Durgapur / Bardhaman', center: { latitude: 23.6889, longitude: 86.9661 }, boundingBox: [86.5, 23.0, 88.0, 24.2] },
    '72': { state: 'West Bengal', circle: 'West Bengal Circle', district: 'Midnapore / Kharagpur', center: { latitude: 22.4257, longitude: 87.3199 }, boundingBox: [86.8, 21.8, 88.0, 22.9] },
    '73': { state: 'West Bengal / Sikkim', circle: 'West Bengal Circle', district: 'Siliguri / Darjeeling / Gangtok', center: { latitude: 26.7271, longitude: 88.3953 }, boundingBox: [87.8, 26.3, 89.2, 27.8] },
    '74': { state: 'West Bengal', circle: 'West Bengal Circle', district: 'North & South 24 Parganas / Nadia', center: { latitude: 22.721, longitude: 88.4847 }, boundingBox: [88.3, 21.8, 89.2, 23.5] },
    '75': { state: 'Odisha', circle: 'Odisha Circle', district: 'Bhubaneswar / Cuttack / Puri', center: { latitude: 20.2961, longitude: 85.8245 }, boundingBox: [85.2, 19.8, 86.5, 20.8] },
    '76': { state: 'Odisha', circle: 'Odisha Circle', district: 'Berhampur / Koraput', center: { latitude: 19.315, longitude: 84.7941 }, boundingBox: [82.5, 18.5, 85.2, 20.2] },
    '77': { state: 'Odisha', circle: 'Odisha Circle', district: 'Rourkela / Sambalpur', center: { latitude: 22.2604, longitude: 84.8536 }, boundingBox: [83.5, 21.2, 85.5, 22.6] },
    '78': { state: 'Assam', circle: 'Assam Circle', district: 'Guwahati / Dibrugarh / Silchar', center: { latitude: 26.1862, longitude: 91.7483 }, boundingBox: [89.8, 24.5, 96.0, 28.0] },
    '79': { state: 'North Eastern States', circle: 'North East Circle', district: 'Shillong / Imphal / Aizawl / Agartala', center: { latitude: 25.5788, longitude: 91.8933 }, boundingBox: [91.0, 23.0, 95.5, 28.5] },
    '80': { state: 'Bihar', circle: 'Bihar Circle', district: 'Patna / Nalanda / Gaya', center: { latitude: 25.5941, longitude: 85.1376 }, boundingBox: [84.8, 24.5, 85.8, 25.8] },
    '81': { state: 'Bihar / Jharkhand', circle: 'Bihar Circle', district: 'Bhagalpur / Deoghar', center: { latitude: 25.2425, longitude: 86.9842 }, boundingBox: [86.2, 24.2, 87.5, 25.5] },
    '82': { state: 'Bihar', circle: 'Bihar Circle', district: 'Muzaffarpur / Darbhanga', center: { latitude: 26.1209, longitude: 85.3647 }, boundingBox: [84.8, 25.6, 86.2, 26.8] },
    '83': { state: 'Jharkhand', circle: 'Jharkhand Circle', district: 'Ranchi / Jamshedpur / Dhanbad', center: { latitude: 23.3441, longitude: 85.3096 }, boundingBox: [84.5, 22.5, 86.8, 24.0] },
    '84': { state: 'Bihar', circle: 'Bihar Circle', district: 'Chapra / Siwan / Gopalganj', center: { latitude: 25.7796, longitude: 84.7499 }, boundingBox: [84.0, 25.5, 85.0, 26.5] },
    '85': { state: 'Bihar', circle: 'Bihar Circle', district: 'Purnea / Katihar', center: { latitude: 25.7771, longitude: 87.4753 }, boundingBox: [86.8, 25.2, 88.2, 26.5] },
    '90': { state: 'Armed Forces', circle: 'Army Postal Service', district: '1 Central Base Post Office (1 CBPO)', center: { latitude: 28.5885, longitude: 77.1352 }, boundingBox: [77.1, 28.5, 77.2, 28.6] },
    '99': { state: 'Armed Forces', circle: 'Army Postal Service', district: '2 Central Base Post Office (2 CBPO)', center: { latitude: 22.5726, longitude: 88.3639 }, boundingBox: [88.3, 22.5, 88.4, 22.6] },
  };

  /**
   * Looks up a 6-digit Indian PIN Code.
   * If exact delivery post office is in the registry, returns full record.
   * Otherwise, hierarchically derives zone, state, circle, and centroid from the subzone index.
   */
  public lookupPINCode(pincode: string): PINCodeInfo | null {
    const trimmed = String(pincode).trim();
    if (!/^[1-9][0-9]{5}$/.test(trimmed)) {
      return null;
    }

    // Exact match in primary registry
    const exact = this.directory[trimmed];
    if (exact) return exact;

    // Hierarchical resolution from 2-digit subzone prefix
    const prefix2 = trimmed.slice(0, 2);
    const meta = this.subzonePrefixMap[prefix2];
    if (meta) {
      // Calculate micro-offset within bounding box based on last 3 digits (001 - 999)
      const last3 = parseInt(trimmed.slice(3), 10) || 50;
      const normalizedOffset = (last3 % 100) / 100.0 - 0.5; // -0.5 .. +0.5
      const dLat = (meta.boundingBox[3] - meta.boundingBox[1]) * 0.15 * normalizedOffset;
      const dLng = (meta.boundingBox[2] - meta.boundingBox[0]) * 0.15 * normalizedOffset;

      return {
        pincode: trimmed,
        postOffice: `${meta.district} S.O (${trimmed})`,
        district: meta.district,
        state: meta.state,
        circle: meta.circle,
        center: {
          latitude: Math.round((meta.center.latitude + dLat) * 1e4) / 1e4,
          longitude: Math.round((meta.center.longitude + dLng) * 1e4) / 1e4,
        },
        boundingBox: meta.boundingBox,
      };
    }

    return null;
  }

  /**
   * Extracts Indian address components: PIN Code, metro pillars, gali/lane, and landmark cues.
   */
  public parseIndianAddress(address: string): ParsedIndianAddress {
    const res: ParsedIndianAddress = {
      rawInput: address,
      landmarks: [],
      estimatedLocation: { latitude: 28.6139, longitude: 77.209 },
      confidenceScore: 0.6,
    };

    // 1. Extract 6-digit PIN Code
    const pinRegex = /\b([1-9][0-9]{5})\b/;
    const pinMatch = pinRegex.exec(address);
    if (pinMatch) {
      const pin = pinMatch[1];
      res.pincode = pin;
      const info = this.lookupPINCode(pin);
      if (info) {
        res.bestMatchPin = info;
        res.estimatedLocation = info.center;
        res.cityDistrict = info.district;
        res.state = info.state;
        res.confidenceScore = 0.95;
      }
    }

    // 2. Metro Pillar recognition (e.g. Metro Pillar 142, Pillar No. 54B)
    const pillarRegex = /(?:metro\s+pillar|pillar\s+no\.?)\s*([0-9]+[a-z]?)/i;
    const pillarMatch = pillarRegex.exec(address);
    if (pillarMatch) {
      res.metroPillar = pillarMatch[0];
      res.confidenceScore = Math.min(1.0, res.confidenceScore + 0.1);
    }

    // 3. Indian Landmark cues (near, opp, opposite, behind, beside, adjacent to, chowk, cross, mandir)
    const landmarkRegex = /(?:near|opp|opposite|behind|beside|adjacent to|chowk|cross|marg|circle|bhavan|mandir)\s+([^,]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = landmarkRegex.exec(address)) !== null) {
      if (match[1]) {
        res.landmarks.push(match[1].trim());
      }
    }

    // 4. Street / Gali / Lane / Sector / Block
    const galiRegex = /(?:gali\s+no\.?|street\s+no\.?|road\s+no\.?|sector\s+[0-9]+[a-z]?|block\s+[a-z0-9]+|marg|rasta|lane)\s*([^,]+)?/i;
    const galiMatch = galiRegex.exec(address);
    if (galiMatch) {
      res.streetOrGali = galiMatch[0].trim();
    }

    return res;
  }

  /**
   * Reverse Geocodes coordinates to the closest Indian postal area and PIN Code.
   */
  public reverseLookup(lat: number, lng: number): PINCodeInfo {
    let closest: PINCodeInfo | null = null;
    let minDist = Infinity;

    // Check all primary post offices
    for (const info of Object.values(this.directory)) {
      const d = calculateDistance(lat, lng, info.center.latitude, info.center.longitude);
      if (d < minDist) {
        minDist = d;
        closest = info;
      }
    }

    // Check all subzone centroids
    for (const [prefix, sub] of Object.entries(this.subzonePrefixMap)) {
      const d = calculateDistance(lat, lng, sub.center.latitude, sub.center.longitude);
      if (d < minDist) {
        minDist = d;
        closest = {
          pincode: `${prefix}0001`,
          postOffice: `${sub.district} Main Post Office`,
          district: sub.district,
          state: sub.state,
          circle: sub.circle,
          center: sub.center,
          boundingBox: sub.boundingBox,
        };
      }
    }

    return closest ?? this.directory['110001'];
  }
}

export const pincodeService = new PINCodeService();
export const pinCodeEngineService = pincodeService;
