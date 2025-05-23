const { gql } = require("apollo-server-express");

const typeDefs = gql`
  scalar Upload

  type User {
    id: ID!
    name: String!
    email: String!
    role: String!
    profilePicture: String
    createdAt: String!
  }

  type Product {
    id: ID!
    name: String!
    price: Float!
    image: String!
    category: String!
    quantity: Int!
    createdAt: String!
    seller: User!
  }

  type OrderItem {
    product: Product!
    quantity: Int!
    price: Float!
  }

  type Order {
    id: ID!
    buyer: User!
    products: [OrderItem!]!
    total: Float!
    status: String!
    createdAt: String!
  }

  type DashboardStats {
    totalOrders: Int!
    totalRevenue: Float!
    activeListings: Int!
    recentTransactions: [Order!]!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    getUser(id: ID!): User
    getProducts: [Product]!
    getProduct(id: ID!): Product
    getProductsByCategory(category: String!): [Product]!
    getUserProducts(sellerId: ID!): [Product]!
    getFarmerOrders: [Order]!
    getBuyerOrders: [Order]!
    getTransactions: [Order]!
    getDashboardStats: DashboardStats!
  }

  input UserInput {
    name: String!
    email: String!
    password: String!
    role: String!
  }

  input ProductInput {
    name: String!
    price: Float!
    image: String
    category: String!
    quantity: Int!
  }

  input OrderItemInput {
    productId: ID!
    quantity: Int!
  }

  input SignupInput {
    name: String!
    email: String!
    password: String!
    role: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  type Mutation {
    registerUser(input: UserInput!): User!
    loginUser(email: String!, password: String!): String!
    createProduct(input: ProductInput!): Product!
    updateProduct(id: ID!, input: ProductInput!): Product!
    deleteProduct(id: ID!): Boolean!
    createOrder(products: [OrderItemInput!]!): Order!
    updateOrderStatus(id: ID!, status: String!): Order!
    signup(input: SignupInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    uploadProductImage(file: Upload!): String!
    logout: Boolean!
  }
`;

module.exports = typeDefs;
